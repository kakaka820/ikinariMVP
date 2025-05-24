import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBzYCHcumBzRw3DLs8mjLiGTiXxvxmjLDU",
  authDomain: "unsoleinight-schedule.firebaseapp.com",
  projectId: "unsoleinight-schedule",
  storageBucket: "unsoleinight-schedule.appspot.com",
  messagingSenderId: "1040333692698",
  appId: "1:1040333692698:web:fb0e4f481dff8167f756a3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.users = {};
window.currentUser = "";

signInAnonymously(auth)
  .then(() => console.log("匿名ログイン成功"))
  .catch((error) => {
    console.error("匿名ログイン失敗:", error);
    alert("認証エラーが発生しました");
  });

onAuthStateChanged(auth, async (user) => {
  if (user) {
    window.currentUser = user.uid;
    document.getElementById("formSection").classList.remove("hidden");
    document.getElementById("resultSection").classList.remove("hidden");
    document.getElementById("welcomeMsg").textContent = `ID: ${user.uid}`;
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      window.users[user.uid] = docSnap.data();
    }
    loadPreviousAnswers();
    await showAllResults();
  }
});

window.showRegister = () => {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("registerSection").classList.remove("hidden");
};

window.backToLogin = () => {
  document.getElementById("registerSection").classList.add("hidden");
  document.getElementById("loginSection").classList.remove("hidden");
};

function loadPreviousAnswers() {
  const answers = window.users[window.currentUser]?.answers || {};
  const comment = window.users[window.currentUser]?.comment || "";
  ["date1", "date2", "date3"].forEach(name => {
    if (answers[name]) {
      const el = document.querySelector(`input[name="${name}"][value="${answers[name]}"]`);
      if (el) el.checked = true;
    }
  });
  document.getElementById("comment").value = comment;
}

window.showAllResults = async function () {
  const tbody = document.getElementById("resultTable").querySelector("tbody");
  const status = document.getElementById("maruStatusResult");
  tbody.innerHTML = "";
  if (status) status.textContent = "";

  try {
    const docsArray = [];
    const querySnapshot = await getDocs(collection(db, "users"));
    querySnapshot.forEach(docSnap => {
      docsArray.push({ id: docSnap.id, data: docSnap.data() });
    });

    docsArray.sort((a, b) => {
      const t1 = a.data.updatedAt ? a.data.updatedAt.toMillis() : 0;
      const t2 = b.data.updatedAt ? b.data.updatedAt.toMillis() : 0;
      return t1 - t2;
    });

    window.users = {};
    const maruUsersByDate = { date1: [], date2: [], date3: [] };

    docsArray.forEach(({ id, data }) => {
      window.users[id] = data;
      const ans = data.answers || {};
      if (ans.date1 === "〇") maruUsersByDate.date1.push(id);
      if (ans.date2 === "〇") maruUsersByDate.date2.push(id);
      if (ans.date3 === "〇") maruUsersByDate.date3.push(id);
    });

    const highlightedUsers = {
      date1: maruUsersByDate.date1.slice(0, 3),
      date2: maruUsersByDate.date2.slice(0, 3),
      date3: maruUsersByDate.date3.slice(0, 3),
    };

    if (status && (
      maruUsersByDate.date1.length >= 3 ||
      maruUsersByDate.date2.length >= 3 ||
      maruUsersByDate.date3.length >= 3
    )) {
      status.textContent = "この会はすでに満席となりました。以降は観戦/リザーバー枠での参加を募集いたします。";
    }

    docsArray.forEach(({ id, data }) => {
      const ans = data.answers || {};
      const comment = data.comment || "";
      if (!ans.date1 && !ans.date2 && !ans.date3 && !comment) return;

      const date1Class = highlightedUsers.date1.includes(id) ? "highlight" : "";
      const date2Class = highlightedUsers.date2.includes(id) ? "highlight" : "";
      const date3Class = highlightedUsers.date3.includes(id) ? "highlight" : "";

      const row = `
        <tr>
          <td>${id}</td>
          <td class="${date1Class}">${ans.date1 || ""}</td>
          <td class="${date2Class}">${ans.date2 || ""}</td>
          <td class="${date3Class}">${ans.date3 || ""}</td>
          <td>${comment}</td>
        </tr>
      `;
      tbody.innerHTML += row;
    });

  } catch (error) {
    console.error("データ取得エラー:", error);
  }
};

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("scheduleForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!window.currentUser) {
      alert("ログインしてください。");
      return;
    }

    const answers = {};
    ["date1", "date2", "date3"].forEach(date => {
      answers[date] = document.querySelector(`input[name="${date}"]:checked`)?.value || "";
    });

    const comment = document.getElementById("comment").value;
    const prevAnswers = window.users[window.currentUser]?.answers || {};

    const updateData = {
      password: window.users[window.currentUser].password,
      answers: answers,
      comment: comment,
    };

    if (JSON.stringify(answers) !== JSON.stringify(prevAnswers)) {
      updateData.updatedAt = serverTimestamp();
    }

    await setDoc(doc(db, "users", window.currentUser), updateData);
    window.users[window.currentUser] = { ...updateData };
    document.getElementById("submitMessage").textContent = "回答を保存しました！";
    await showAllResults();
  });
});
