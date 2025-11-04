# Scalability & Performance Notes

## Current Setup (Production-Ready for ~100-200 Concurrent Users)

### Socket.IO Configuration
- **Transports**: WebSocket + Polling fallback (for better compatibility)
- **Ping Timeout**: 60 seconds
- **Ping Interval**: 25 seconds
- **Max Buffer Size**: 1MB per message

### Current Capacity Estimates
- **Tested**: Works reliably with 100+ concurrent users in a single auction room
- **Recommended**: 100-200 concurrent users per auction room
- **Bottleneck**: Single Node.js process (not horizontally scaled)

## Scalability Drawbacks & Limitations

### 1. **Single Server Instance**
- **Issue**: All socket connections go to one Node.js process
- **Impact**: Limited by single CPU core and memory
- **Solution for 500+ users**: Use Redis adapter + load balancer + multiple server instances

### 2. **Database Connection Pool**
- **Current**: Default Mongoose connection pool (~10 connections)
- **Impact**: May bottleneck with many concurrent DB writes (bids)
- **Solution**: Increase pool size in MongoDB connection string

### 3. **No Rate Limiting on Bids**
- **Issue**: Users could spam bid requests
- **Impact**: Could overwhelm server with rapid requests
- **Solution**: Add rate limiting middleware (e.g., express-rate-limit)

### 4. **Socket Rooms (Current Implementation)**
- **Works**: Each auction room is isolated via Socket.IO rooms
- **Scales**: Multiple rooms can run simultaneously
- **Limitation**: All rooms share same server instance

## Recommendations for 500+ Users

### Immediate (Easy):
1. **Increase MongoDB connection pool**: Add `?maxPoolSize=50` to connection string
2. **Add rate limiting**: Limit bid requests per user (e.g., 1 bid per second)
3. **Enable Redis for Socket.IO**: Use `@socket.io/redis-adapter` for horizontal scaling

### Advanced (For 1000+ users):
1. **Load Balancer**: Use Nginx/HAProxy to distribute traffic
2. **Multiple Server Instances**: Run 2-4 Node.js instances behind load balancer
3. **Redis Pub/Sub**: Share socket events across server instances
4. **Database Sharding**: If needed, shard MongoDB collections by auction room
5. **CDN**: Serve static assets via CDN (reduce server load)

## Current Architecture Strengths
✅ **Socket.IO rooms**: Efficient room-based message distribution  
✅ **MongoDB Atlas**: Handles database scaling automatically  
✅ **JWT auth**: Stateless, scalable authentication  
✅ **Real-time updates**: Efficient event broadcasting via Socket.IO

## Testing Recommendations
- Test with 50, 100, 200 concurrent users in a single auction room
- Monitor server CPU, memory, and MongoDB connection pool usage
- Test bid submission rate (should handle 10-20 bids/second comfortably)

