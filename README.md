# ClashBid 🏏
**ClashBid** is a high-performance, real-time cricket auction platform designed for organizers to host seamless player auctions. Whether you are managing a local league or a large-scale tournament, ClashBid provides the tools to import data, manage teams, and execute live bidding with sub-second latency.

**Live Demo:** [clashbid.live](https://clashbid.live)

---

## 🚀 Key Features

### 🛠️ Admin Control Center
* **Dynamic Setup**: Initialize an auction room by uploading CSV files for teams and players or by using the **Manual Entry** panel.
* **Gallery Integration**: Manually add players with photos directly from your device gallery using Base64 encoding.
* **Automated Authentication**: Providing a captain's email during team setup automatically creates their account and links it to the auction room.
* **Real-time Management**: Start, pause, or resume the auction. Admin controls the flow, ensuring only one player is up for bid at a time.
* **Data Export**: Once the auction concludes, download a comprehensive CSV report containing all sold and unsold player data.

### 🧢 Captain & Player Experience
* **Room Code Access**: Join active auctions instantly using a unique 6-digit room code.
* **Live Bidding**: Bid in real-time with dynamic increments based on the player's current price.
* **Bid Management**: Captains can skip players or undo their last bid if a mistake was made.
* **Instant Updates**: All participants see bid changes, timer resets, and sales immediately via WebSockets.

---

## 🛠️ Tech Stack

### Frontend
* **Framework**: React (Vite) with TypeScript.
* **Styling**: Tailwind CSS for a modern, dark-themed responsive UI.
* **Components**: Radix UI / shadcn/ui (Dialogs, Tabs, Toasts, Cards).
* **Icons**: Lucide React.
* **State Management**: Custom hooks for authentication and real-time polling.

### Backend
* **Environment**: Node.js & Express.
* **Database**: MongoDB with Mongoose for structured data modeling (Players, Teams, Auctions).
* **Real-time**: Socket.io for low-latency bidding events.
* **Validation**: Joi for strict API request schema enforcement.
* **Auth**: JWT-based access/refresh token system with OTP email verification.

---

## ⚙️ Installation & Setup

### 1. Prerequisites
* Node.js (v18+)
* MongoDB instance
* EmailJS account (for OTP verification)

### 2. Environment Variables
Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret
EMAILJS_SERVICE_ID=your_id
EMAILJS_TEMPLATE_ID=your_id
EMAILJS_PUBLIC_KEY=your_key
EMAILJS_PRIVATE_KEY=your_key
