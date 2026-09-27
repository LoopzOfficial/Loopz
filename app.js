import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

// YOUR CLOUDINARY CONFIG (Pre-filled with your details)
const CLOUDINARY_CLOUD_NAME = "pinn1l4h";
const CLOUDINARY_UPLOAD_PRESET = "ck6jz3ui";

// 1. UPLOAD VIDEO TO CLOUDINARY & SAVE TO FIRESTORE
export async function uploadVideoToLoopz(file, caption) {
    const user = auth.currentUser;
    if (!user) {
        alert("Please sign in first to post a loop!");
        return;
    }

    if (!file) {
        alert("Please select a video file!");
        return;
    }

    const uploadStatus = document.getElementById("upload-status");
    if (uploadStatus) uploadStatus.innerText = "Uploading loop... Please wait ⏳";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
        // Upload video file directly to Cloudinary
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!data.secure_url) {
            throw new Error("Cloudinary upload failed. Check your preset settings.");
        }

        const videoUrl = data.secure_url;

        // Save post details to Firebase Firestore
        await addDoc(collection(db, "posts"), {
            videoUrl: videoUrl,
            caption: caption || "",
            userId: user.uid,
            username: user.displayName || user.email.split("@")[0],
            likes: 0,
            createdAt: serverTimestamp()
        });

        if (uploadStatus) uploadStatus.innerText = "Loop uploaded successfully! 🚀";
        
        setTimeout(() => {
            const modal = document.getElementById("upload-modal");
            if (modal) modal.style.display = "none";
            loadLoopzFeed(); // Reload feed with newly posted video
        }, 1200);

    } catch (error) {
        alert("Upload error: " + error.message);
        if (uploadStatus) uploadStatus.innerText = "";
    }
}

// 2. FETCH REAL-TIME POSTS & RENDER FEED
export async function loadLoopzFeed() {
    const feedContainer = document.getElementById("feed");
    if (!feedContainer) return;

    try {
        const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(postsQuery);

        if (querySnapshot.empty) {
            return; // Keeps default demo video if database is empty
        }

        feedContainer.innerHTML = ""; // Clear demo feed

        querySnapshot.forEach((docSnap) => {
            const post = docSnap.data();

            const card = document.createElement("div");
            card.className = "video-card";
            card.innerHTML = `
                <video src="${post.videoUrl}" loop playsinline muted></video>
                <div class="ui-overlay">
                    <div class="username">@${post.username}</div>
                    <div class="caption">${post.caption}</div>
                </div>
                <div class="action-sidebar">
                    <button class="action-btn">⚡ <span>${post.likes || 0}</span></button>
                    <button class="action-btn">💬 <span>0</span></button>
                    <button class="action-btn">🔁 <span>Share</span></button>
                </div>
            `;

            // Tap video to toggle play/pause & unmute
            card.addEventListener("click", () => {
                const vid = card.querySelector("video");
                vid.muted = false;
                vid.paused ? vid.play() : vid.pause();
            });

            feedContainer.appendChild(card);
        });

        setupScrollObserver();
    } catch (err) {
        console.error("Error loading feed:", err);
    }
}

// 3. AUTO PLAY/PAUSE VIDEOS ON SCROLL
function setupScrollObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector("video");
            if (video) {
                if (entry.isIntersecting) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            }
        });
    }, { threshold: 0.6 });

    document.querySelectorAll(".video-card").forEach(card => observer.observe(card));
}

// Load videos as soon as the app opens
window.addEventListener("DOMContentLoaded", loadLoopzFeed);
