#!/bin/bash
cd /root/facade-frenzy-online
node server.js &
SERVER_PID=$!
sleep 2
node test/test-all.js
EXIT_CODE=$?
kill $SERVER_PID 2>/dev/null
exit $EXIT_CODE