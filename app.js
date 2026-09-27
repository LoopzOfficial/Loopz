import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

// CLOUDINARY CONFIG
const CLOUDINARY_CLOUD_NAME = "pinn1l4h";
const CLOUDINARY_UPLOAD_PRESET = "ck6jz3ui";

// 1. UPLOAD VIDEO FILE TO CLOUDINARY AND SAVE METADATA TO FIRESTORE
export async function uploadVideoToLoopz(file, caption) {
    const user = auth.currentUser;
    if (!user) {
        alert("Please sign in to post a loop!");
        document.getElementById("auth-modal").style.display = "flex";
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
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!data.secure_url) {
            throw new Error("Cloudinary upload failed. Check preset configuration.");
        }

        const videoUrl = data.secure_url;

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
            loadLoopzFeed();
        }, 1200);

    } catch (error) {
        alert("Upload error: " + error.message);
        if (uploadStatus) uploadStatus.innerText = "";
    }
}

// 2. FETCH REAL-TIME POSTS FROM FIRESTORE AND BUILD FEED
export async function loadLoopzFeed() {
    const feedContainer = document.getElementById("feed");
    if (!feedContainer) return;

    try {
        const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(postsQuery);

        if (querySnapshot.empty) {
            return;
        }

        feedContainer.innerHTML = "";

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

// AUTO PLAY/PAUSE ON SCROLL
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

window.addEventListener("DOMContentLoaded", loadLoopzFeed);
