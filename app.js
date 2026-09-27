import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where,
    orderBy, 
    serverTimestamp,
    doc,
    setDoc,
    updateDoc,
    increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { auth, db, followUser, unfollowUser, isFollowing, getFollowCounts, getUserProfileData } from "./firebase.js";

const CLOUDINARY_CLOUD_NAME = "pinn1l4h";
const CLOUDINARY_UPLOAD_PRESET = "ck6jz3ui";

let currentFeedTab = "foryou";

// 1. UPDATE USER PROFILE (HANDLE, PFP, BIO)
export async function updateUserProfile(newUsername, bioText, pfpFile) {
    const user = auth.currentUser;
    if (!user) return;

    const profileStatus = document.getElementById("edit-profile-status");
    if (profileStatus) profileStatus.innerText = "Saving profile... ⏳";

    try {
        let photoURL = user.photoURL || "";

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

        // Save to Firebase Auth
        await updateProfile(user, {
            displayName: newUsername || user.displayName,
            photoURL: photoURL
        });

        // Save Bio & Profile to Firestore
        await setDoc(doc(db, "users", user.uid), {
            username: newUsername || user.displayName,
            photoURL: photoURL,
            bio: bioText || "",
            uid: user.uid
        }, { merge: true });

        if (profileStatus) profileStatus.innerText = "Profile updated! 🚀";

        setTimeout(() => {
            document.getElementById("edit-profile-modal").style.display = "none";
            if (profileStatus) profileStatus.innerText = "";
            openProfileView(user.uid);
        }, 800);

    } catch (err) {
        alert("Profile update error: " + err.message);
        if (profileStatus) profileStatus.innerText = "";
    }
}

// 2. OPEN INSTAGRAM-STYLE PROFILE PAGE
export async function openProfileView(userId) {
    const user = auth.currentUser;
    const profileModal = document.getElementById("profile-modal");
    if (!profileModal) return;

    profileModal.style.display = "flex";

    // Fetch Stats
    const stats = await getFollowCounts(userId);
    document.getElementById("stat-posts-count").innerText = stats.posts;
    document.getElementById("stat-followers-count").innerText = stats.followers;
    document.getElementById("stat-following-count").innerText = stats.following;

    // Fetch Profile Details
    const profileData = await getUserProfileData(userId);
    const username = profileData?.username || user?.displayName || "creator";
    const bio = profileData?.bio || "Welcome to my Loopz profile! ⚡";
    const photoURL = profileData?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

    document.getElementById("profile-header-username").innerText = `@${username}`;
    document.getElementById("profile-display-name").innerText = username;
    document.getElementById("profile-bio").innerText = bio;
    document.getElementById("profile-pfp").src = photoURL;

    // Render User Posts Grid
    loadUserPostsGrid(userId);
}

// 3. LOAD USER POSTS IN 3-COLUMN GRID
async function loadUserPostsGrid(userId) {
    const gridContainer = document.getElementById("user-posts-grid");
    if (!gridContainer) return;

    gridContainer.innerHTML = `<p style="color:#666; font-size:12px; grid-column: span 3; text-align:center; padding: 20px;">Loading loops...</p>`;

    try {
        const q = query(collection(db, "posts"), where("userId", "==", userId), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            gridContainer.innerHTML = `<p style="color:#666; font-size:12px; grid-column: span 3; text-align:center; padding: 20px;">No loops posted yet.</p>`;
            return;
        }

        gridContainer.innerHTML = "";

        querySnapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const gridItem = document.createElement("div");
            gridItem.className = "grid-item";
            gridItem.innerHTML = `
                <video src="${post.videoUrl}#t=0.1" preload="metadata"></video>
                <div class="grid-item-likes">⚡ ${post.likes || 0}</div>
            `;
            gridContainer.appendChild(gridItem);
        });
    } catch (err) {
        console.error("Error loading profile grid:", err);
        gridContainer.innerHTML = `<p style="color:#666; font-size:12px; grid-column: span 3; text-align:center;">Failed to load posts.</p>`;
    }
}

// 4. UPLOAD VIDEO
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
        alert("Video size is too large! Pick a file under 50MB.");
        return;
    }

    if (uploadStatus) uploadStatus.innerText = "1/2 Uploading video... ⏳";

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

        if (uploadStatus) uploadStatus.innerText = "2/2 Saving post... ⚡";

        await addDoc(collection(db, "posts"), {
            videoUrl: data.secure_url,
            caption: caption || "",
            userId: user.uid,
            username: user.displayName || "creator",
            userPfp: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.displayName || "creator"}`,
            likes: 0,
            createdAt: serverTimestamp()
        });

        if (uploadStatus) uploadStatus.innerText = "Posted successfully! 🚀";

        setTimeout(() => {
            const modal = document.getElementById("upload-modal");
            if (modal) modal.style.display = "none";
            if (uploadStatus) uploadStatus.innerText = "";
            loadLoopzFeed();
        }, 1000);

    } catch (error) {
        alert("Upload error: " + error.message);
        if (uploadStatus) uploadStatus.innerText = "";
    }
}

// 5. RENDER MAIN FEED
export async function loadLoopzFeed(tab = currentFeedTab) {
    currentFeedTab = tab;
    const feedContainer = document.getElementById("feed");
    if (!feedContainer) return;

    try {
        const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(postsQuery);

        if (querySnapshot.empty) {
            feedContainer.innerHTML = `
                <div class="video-card" style="display:flex; justify-content:center; align-items:center;">
                    <p style="color:#888;">No loops posted yet. Tap + to post!</p>
                </div>`;
            return;
        }

        feedContainer.innerHTML = "";

        for (const docSnap of querySnapshot.docs) {
            const post = docSnap.data();
            const postId = docSnap.id;
            const avatar = post.userPfp || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.username}`;
            
            const isOfficial = ["loopz", "loopzofficial"].includes(post.username.toLowerCase());
            const badgeHTML = isOfficial ? `<span class="verified-badge">✔</span>` : ``;

            const currentUser = auth.currentUser;
            const isSelf = currentUser && currentUser.uid === post.userId;
            const currentlyFollowing = await isFollowing(post.userId);

            const followBtnHTML = isSelf ? '' : `
                <button class="follow-btn ${currentlyFollowing ? 'following' : ''}" data-uid="${post.userId}">
                    ${currentlyFollowing ? 'Following' : 'Follow'}
                </button>
            `;

            const card = document.createElement("div");
            card.className = "video-card";
            card.innerHTML = `
                <video src="${post.videoUrl}" loop playsinline muted></video>
                <div class="ui-overlay">
                    <div class="user-row">
                        <img src="${avatar}" class="feed-avatar">
                        <div class="username">@${post.username} ${badgeHTML}</div>
                        ${followBtnHTML}
                    </div>
                    <div class="caption">${post.caption}</div>
                </div>
                <div class="action-sidebar">
                    <button class="action-btn like-btn" data-id="${postId}">⚡ <span>${post.likes || 0}</span></button>
                    <button class="action-btn">💬 <span>0</span></button>
                    <button class="action-btn">🔁 <span>Share</span></button>
                </div>
            `;

            card.addEventListener("click", (e) => {
                if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
                const vid = card.querySelector("video");
                vid.muted = false;
                vid.paused ? vid.play() : vid.pause();
            });

            const flwBtn = card.querySelector(".follow-btn");
            if (flwBtn) {
                flwBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    const targetUid = flwBtn.getAttribute("data-uid");
                    if (flwBtn.classList.contains("following")) {
                        await unfollowUser(targetUid);
                        flwBtn.innerText = "Follow";
                        flwBtn.classList.remove("following");
                    } else {
                        const success = await followUser(targetUid);
                        if (success) {
                            flwBtn.innerText = "Following";
                            flwBtn.classList.add("following");
                        }
                    }
                });
            }

            const likeBtn = card.querySelector(".like-btn");
            if (likeBtn) {
                likeBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    try {
                        const postRef = doc(db, "posts", postId);
                        await updateDoc(postRef, { likes: increment(1) });
                        const countSpan = likeBtn.querySelector("span");
                        countSpan.innerText = parseInt(countSpan.innerText) + 1;
                    } catch (err) {
                        console.error("Like error:", err);
                    }
                });
            }

            feedContainer.appendChild(card);
        }

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

window.addEventListener("DOMContentLoaded", () => loadLoopzFeed("foryou"));
