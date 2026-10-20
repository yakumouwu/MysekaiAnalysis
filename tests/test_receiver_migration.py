import json
import threading
import time
import unittest
from unittest import mock

from test_receiver_unit import load_receiver_module


class MigrationReceiverTests(unittest.TestCase):
    def test_http_200_onebot_failure_is_retried_and_not_reported_success(self):
        receiver = load_receiver_module()
        receiver.BOT_PUSH_ENABLED = True
        receiver.BOT_PUSH_URL = 'http://snowluma:3000'
        receiver.BOT_TARGET_ID = '123456'
        receiver.BOT_PUSH_MODE = 'group'
        receiver.BOT_PUSH_RETRY = 2
        response = mock.MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({'status': 'failed', 'retcode': 1200}).encode()
        with mock.patch.object(receiver.urllib.request, 'urlopen', return_value=response) as request, mock.patch.object(receiver.time, 'sleep'):
            ok, _ = receiver.send_bot_message('test')
        self.assertFalse(ok)
        self.assertEqual(request.call_count, 2)

    def test_render_slot_excludes_parallel_work_and_recovers_after_failure(self):
        receiver = load_receiver_module()
        start = threading.Barrier(3)
        active, peak = 0, 0
        guard = threading.Lock()

        @receiver.serialized_render
        def work():
            nonlocal active, peak
            with guard:
                active += 1
                peak = max(peak, active)
            time.sleep(0.03)
            with guard:
                active -= 1

        def caller():
            start.wait()
            work()

        threads = [threading.Thread(target=caller) for _ in range(2)]
        for thread in threads:
            thread.start()
        start.wait()
        for thread in threads:
            thread.join(timeout=2)
            self.assertFalse(thread.is_alive())
        self.assertEqual(peak, 1)

        @receiver.serialized_render
        def failing():
            raise RuntimeError('render failed')

        with self.assertRaises(RuntimeError):
            failing()
        self.assertTrue(receiver.RENDER_LOCK.acquire(timeout=0.1))
        receiver.RENDER_LOCK.release()
