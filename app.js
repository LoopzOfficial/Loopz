import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { auth, db } from "./firebase.js";

// CLOUDINARY CONFIG
const CLOUDINARY_CLOUD_NAME = "pinn1l4h";
const CLOUDINARY_UPLOAD_PRESET = "ck6jz3ui";

// 1. UPDATE USERNAME & PROFILE PICTURE
export async function updateUserProfile(newUsername, pfpFile) {
    const user = auth.currentUser;
    if (!user) return;

    const profileStatus = document.getElementById("profile-status");
    if (profileStatus) profileStatus.innerText = "Updating profile... ⏳";

    try {
        let photoURL = user.photoURL || "";

        // Upload avatar image to Cloudinary if selected
        if (pfpFile) {
            const formData = new FormData();
            formData.append("file", pfpFile);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (data.secure_url) {
                photoURL = data.secure_url;
            }
        }

        // Save username and pfp URL to Firebase Auth
        await updateProfile(user, {
            displayName: newUsername || user.displayName,
            photoURL: photoURL
        });

        if (profileStatus) profileStatus.innerText = "Profile updated! 🚀";

        setTimeout(() => {
            const modal = document.getElementById("profile-modal");
            if (modal) modal.style.display = "none";
            location.reload();
        }, 1000);

    } catch (err) {
        alert("Profile update error: " + err.message);
        if (profileStatus) profileStatus.innerText = "";
    }
}

// 2. UPLOAD VIDEO TO CLOUDINARY & SAVE TO FIRESTORE
export async function uploadVideoToLoopz(file, caption) {
    const user = auth.currentUser;
    const uploadStatus = document.getElementById("upload-status");

    if (!user) {
        alert("Please sign in first to post a loop!");
        document.getElementById("auth-modal").style.display = "flex";
        return;
    }

    if (!file) {
        alert("Please select a video file!");
        return;
    }

    if (file.size > 50 * 1024 * 1024) {
        alert("Video size is too large! Please choose a video under 50MB.");
        return;
    }

    if (uploadStatus) uploadStatus.innerText = "1/2 Uploading video file... ⏳";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error.message);
        if (!data.secure_url) throw new Error("Upload failed. Verify preset settings.");

        if (uploadStatus) uploadStatus.innerText = "2/2 Saving to Loopz... ⚡";

        await addDoc(collection(db, "posts"), {
            videoUrl: data.secure_url,
            caption: caption || "",
            userId: user.uid,
            username: user.displayName || "loopz_creator",
            userPfp: user.photoURL || "https://api.dicebear.com/7.x/bottts/svg?seed=" + (user.displayName || "creator"),
            likes: 0,
            createdAt: serverTimestamp()
        });

        if (uploadStatus) uploadStatus.innerText = "Posted successfully! 🚀";

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

// 3. FETCH AND DISPLAY LIVE FEED
export async function loadLoopzFeed() {
    const feedContainer = document.getElementById("feed");
    if (!feedContainer) return;

    try {
        const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(postsQuery);

        if (querySnapshot.empty) return;

        feedContainer.innerHTML = "";

        querySnapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const avatar = post.userPfp || "https://api.dicebear.com/7.x/bottts/svg?seed=" + post.username;

            const card = document.createElement("div");
            card.className = "video-card";
            card.innerHTML = `
                <video src="${post.videoUrl}" loop playsinline muted></video>
                <div class="ui-overlay">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <img src="${avatar}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid #a855f7;">
                        <div class="username">@${post.username}</div>
                    </div>
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

function setupScrollObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector("video");
            if (video) {
                entry.isIntersecting ? video.play().catch(() => {}) : video.pause();
            }
        });
    }, { threshold: 0.6 });

    document.querySelectorAll(".video-card").forEach(card => observer.observe(card));
}

window.addEventListener("DOMContentLoaded", loadLoopzFeed);
