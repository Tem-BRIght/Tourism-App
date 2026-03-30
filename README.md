Pasig City AI Guide

**Ionic React** 

mobile web app that helps tourists and locals discover Pasig City (Philippines).  
Powered by **Groq Llama 3.3** (AI chat), **Firebase** (reviews, favourites, notifications), **Leaflet** (maps & directions), and **Web Speech API** (voice input / TTS).

![Ionic](https://img.shields.io/badge/Ionic-7.x-3880FF?logo=ionic)
![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-10.x-FFCA28?logo=firebase)
![Groq](https://img.shields.io/badge/Groq-LLaMA_3.3-FF6B6B)

---

## ✨ Features

- **AI Travel Assistant** – ask anything about Pasig (places, food, history).  
- **Voice input & text‑to‑speech** – speak to ALI, hear answers aloud.  
- **Place suggestions** – AI returns relevant destination cards (rating, distance, address).  
- **Interactive map** – search, browse, and navigate to any destination.  
- **Detailed destination pages** – hours, admission, amenities, photo gallery, itineraries (AI‑generated).  
- **Reviews & replies** – users can rate, write reviews, and reply.  
- **Favourites** – real‑time sync via Firebase RTDB.  
- **Notifications** – real‑time Firestore listener for likes, ratings, visit reminders.  
- **Live rankings** – most visited places (based on QR scan visits).  
- **Routing** – walking, driving, and commute (OSRM).  

---

## 🛠️ Tech Stack

| Layer          | Technology                                                                 |
|----------------|----------------------------------------------------------------------------|
| Frontend       | Ionic Framework 7, React 18, TypeScript, CSS Modules (custom)              |
| State / Auth   | Firebase Auth (Email/Password + Google), Context API                       |
| Database       | Firestore (destinations, reviews, notifications), RTDB (favourites)        |
| AI / Chat      | Groq Cloud (LLaMA 3.3 70B)                                                 |
| Maps & Routing | Leaflet + OSM, OSRM routing (walk, car, commute)                           |
| Voice          | Web Speech API (recognition + synthesis)                                   |
| Build tool     | Vite                                                                       |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm / yarn
- Firebase project (Firestore, Auth, RTDB enabled)
- Groq API key ([console.groq.com](https://console.groq.com))

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
npm install
