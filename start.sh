#!/bin/bash

echo "=========================================="
echo "  MyRecSub - Starting..."
echo "=========================================="
echo ""
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Start backend
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 3

# Start frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Open browser
sleep 3
if command -v xdg-open &> /dev/null; then
  xdg-open http://localhost:3000
elif command -v open &> /dev/null; then
  open http://localhost:3000
fi

echo "Both servers running. Press Ctrl+C to stop."

# Wait and handle Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait $BACKEND_PID $FRONTEND_PID
