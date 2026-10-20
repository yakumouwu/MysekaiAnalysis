"""Recreate selected containers from a private docker-inspect snapshot.

Run on Linux as a Docker administrator. Existing containers are never removed.
Secrets stay in the snapshot and are transmitted only over the Docker Unix socket.
"""
import argparse
import copy
import http.client
import json
import socket
import urllib.parse
from pathlib import Path


class DockerConnection(http.client.HTTPConnection):
    def __init__(self):
        super().__init__('localhost', timeout=60)

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect('/var/run/docker.sock')


def docker_request(method, path, payload=None):
    connection = DockerConnection()
    body = json.dumps(payload).encode() if payload is not None else None
    connection.request(method, path, body, {'Content-Type': 'application/json'})
    response = connection.getresponse()
    data = response.read()
    status = response.status
    connection.close()
    if status >= 400:
        # Docker errors can include configuration values; omit their body.
        raise RuntimeError('Docker API returned HTTP %s for %s' % (status, path.split('?')[0]))
    return json.loads(data) if data else None


def create_payload(snapshot, overrides=None, memory_mib=None):
    payload = copy.deepcopy(snapshot['Config'])
    payload['Image'] = snapshot['Image']  # Restore the exact local image, not a mutable tag.
    host = copy.deepcopy(snapshot['HostConfig'])
    # Explicitly reuse anonymous named volumes instead of allocating empty replacements.
    binds = []
    for mount in snapshot['Mounts']:
        if mount['Type'] not in ('bind', 'volume'):
            raise ValueError('Unsupported mount type in snapshot')
        source = mount['Name'] if mount['Type'] == 'volume' else mount['Source']
        mode = mount.get('Mode') or ('rw' if mount['RW'] else 'ro')
        binds.append(source + ':' + mount['Destination'] + ':' + mode)
    host['Binds'] = binds
    host.pop('Mounts', None)
    if memory_mib is not None:
        host['Memory'] = memory_mib * 1024 * 1024
        host['MemorySwap'] = host['Memory'] * 2
    payload['HostConfig'] = host
    if overrides:
        env = dict(item.split('=', 1) for item in payload.get('Env', []) if '=' in item)
        env.update(overrides)
        payload['Env'] = [key + '=' + str(value) for key, value in env.items()]
    endpoints = {}
    for name, settings in snapshot['NetworkSettings']['Networks'].items():
        endpoints[name] = {key: settings[key] for key in ('Aliases', 'Links', 'IPAMConfig') if settings.get(key)}
    payload['NetworkingConfig'] = {'EndpointsConfig': endpoints}
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('names', nargs='+')
    parser.add_argument('--overrides', type=Path, help='Private JSON environment overrides; never printed')
    parser.add_argument('--memory-mib', type=int)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    snapshots = {item['Name'].lstrip('/'): item for item in json.loads(args.snapshot.read_text())}
    overrides = json.loads(args.overrides.read_text()) if args.overrides else None
    for name in args.names:
        payload = create_payload(snapshots[name], overrides, args.memory_mib)
        if args.dry_run:
            print('Validated restore payload:', name, 'mounts=', len(payload['HostConfig']['Binds']))
            continue
        docker_request('POST', '/containers/create?name=' + urllib.parse.quote(name), payload)
        docker_request('POST', '/containers/' + urllib.parse.quote(name) + '/start')
        print('Restored:', name)


if __name__ == '__main__':
    main()
