import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    createUserWithEmailAndPassword, 
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    deleteDoc, 
    getDoc, 
    collection, 
    query, 
    where, 
    getCountFromServer 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAdOlIbJaXzMymN3MlekGcFRexvIzm5woo",
    authDomain: "loopz-c8941.firebaseapp.com",
    projectId: "loopz-c8941",
    storageBucket: "loopz-c8941.firebasestorage.app",
    messagingSenderId: "1094837904577",
    appId: "1:1094837904577:web:989d0381716e132feea040",
    measurementId: "G-ZP53H4CZ9L"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// AUTHENTICATION
export async function signUpWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await setDoc(doc(db, "users", result.user.uid), {
            username: result.user.displayName || "creator",
            photoURL: result.user.photoURL || "",
            bio: "Welcome to my Loopz profile! ⚡",
            uid: result.user.uid
        }, { merge: true });
        
        alert(`Welcome, ${result.user.displayName || 'Creator'}!`);
        const modal = document.getElementById('auth-modal');
        if (modal) modal.style.display = 'none';
    } catch (error) {
        alert("Google Sign-In Error: " + error.message);
    }
}

export async function signUpWithEmail(email, password, username) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
        
        await setDoc(doc(db, "users", userCredential.user.uid), {
            username: username,
            photoURL: "",
            bio: "Welcome to my Loopz profile! ⚡",
            uid: userCredential.user.uid
        });

        alert(`Account created! Welcome @${username}`);
        const modal = document.getElementById('auth-modal');
        if (modal) modal.style.display = 'none';
    } catch (error) {
        alert("Sign-Up Error: " + error.message);
    }
}

// USER DATA FETCH
export async function getUserProfileData(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return null;
    } catch (e) {
        console.error("Error fetching user profile:", e);
        return null;
    }
}

// FOLLOW SYSTEM
export async function followUser(targetUserId) {
    const user = auth.currentUser;
    if (!user) {
        alert("Please sign in to follow creators!");
        document.getElementById('auth-modal').style.display = 'flex';
        return false;
    }
    if (user.uid === targetUserId) {
        alert("You cannot follow yourself!");
        return false;
    }

    const followId = `${user.uid}_${targetUserId}`;
    await setDoc(doc(db, "follows", followId), {
        followerId: user.uid,
        followingId: targetUserId,
        createdAt: new Date()
    });
    return true;
}

export async function unfollowUser(targetUserId) {
    const user = auth.currentUser;
    if (!user) return false;

    const followId = `${user.uid}_${targetUserId}`;
    await deleteDoc(doc(db, "follows", followId));
    return true;
}

export async function isFollowing(targetUserId) {
    const user = auth.currentUser;
    if (!user) return false;

    const followId = `${user.uid}_${targetUserId}`;
    const snap = await getDoc(doc(db, "follows", followId));
    return snap.exists();
}

export async function getFollowCounts(userId) {
    try {
        const followersQ = query(collection(db, "follows"), where("followingId", "==", userId));
        const followingQ = query(collection(db, "follows"), where("followerId", "==", userId));
        const postsQ = query(collection(db, "posts"), where("userId", "==", userId));

        const [followersSnap, followingSnap, postsSnap] = await Promise.all([
            getCountFromServer(followersQ),
            getCountFromServer(followingQ),
            getCountFromServer(postsQ)
        ]);

        return {
            followers: followersSnap.data().count,
            following: followingSnap.data().count,
            posts: postsSnap.data().count
        };
    } catch (err) {
        console.error("Error fetching stats:", err);
        return { followers: 0, following: 0, posts: 0 };
    }
}
