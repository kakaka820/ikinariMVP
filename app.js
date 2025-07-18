import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDs3xNPpmdzqD1nww2s6mIPbYHtsRvXeY0",
  authDomain: "ikinarimvp.firebaseapp.com",
  projectId: "ikinarimvp",
  storageBucket: "ikinarimvp.firebasestorage.app",
  messagingSenderId: "587616153202",
  appId: "1:587616153202:web:5b6cbc5ca3ac3e8c42dceb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


window.users = {};
window.currentUser = "";
const maruUsers = {};
const highlighted = {}; 


function sha256(str) {
  const buffer = new TextEncoder().encode(str);
  return crypto.subtle.digest("SHA-256", buffer).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
  );
}

async function fetchCandidateDates() {
  const docRef = doc(db, "settings", "eventDates");
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data().list || [] : [];
}

async function renderForm() {
  const dates = await fetchCandidateDates();
  const tbody = document.getElementById("form-body");
  tbody.innerHTML = "";

  dates.forEach(date => {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td");
    dateCell.textContent = `${date}`;
    row.appendChild(dateCell);

    ["〇", "×", "観戦"].forEach(choice => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `response-${date}`;
      input.value = choice;
      td.appendChild(input);
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });
}

async function loadPreviousAnswers() {
  const dates = await fetchCandidateDates();
  const userData = window.users[window.currentUser] || {};
  const answers = userData.answers || {};
  const comment = userData.comment || "";

  dates.forEach(date => {
    const selected = answers[date];
    if (selected) {
      const el = document.querySelector(`input[name="response-${date}"][value="${selected}"]`);
      if (el) el.checked = true;
    }
  });
  document.getElementById("comment").value = comment;
}

async function showAllResults() {
  const dates = await fetchCandidateDates();
  const headerRow = document.getElementById("resultHeaderRow");
  headerRow.innerHTML = "";

  const thUser = document.createElement("th");
  thUser.textContent = "参加者名";
  headerRow.appendChild(thUser);

  dates.forEach(date => {
    const th = document.createElement("th");
    th.textContent = date;
    headerRow.appendChild(th);
  });

  const thComment = document.createElement("th");
  thComment.textContent = "コメント";
  headerRow.appendChild(thComment);

  const tbody = document.getElementById("resultTable").querySelector("tbody");
  const status = document.getElementById("maruStatusResult");
  tbody.innerHTML = "";
  if (status) status.textContent = "";

  const configSnap = await getDoc(doc(db, "settings", "capacity"));
  let MAX = configSnap.exists() ? configSnap.data().maxCapacity : 3;

  const snapshot = await getDocs(collection(db, "users"));
  const docsArray = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));

  docsArray.sort((a, b) => (a.data.updatedAt?.toMillis() || 0) - (b.data.updatedAt?.toMillis() || 0));
  window.users = {};
  dates.forEach(date => { maruUsers[date] = []; });

  docsArray.forEach(({ id, data }) => {
    window.users[id] = data;
    const a = data.answers || {};
    dates.forEach(date => {
      if (a[date] === "〇") maruUsers[date].push(id);
    });
  });

 
  dates.forEach(date => {
    highlighted[date] = maruUsers[date].length >= MAX ? maruUsers[date].slice(0, MAX) : [];
  });

  if (Object.values(maruUsers).some(arr => arr.length >= MAX)) {
    if (status) status.textContent = "満席となった会に関しましてはリザーバー枠での参加を募集いたします。リザーバー希望の方は〇にチェックの上送信お願いします。";
  }

  docsArray.forEach(({ id, data }) => {
    const a = data.answers || {};
    const c = data.comment || "";
    if (!Object.keys(a).length && !c) return;

    const row = document.createElement("tr");
    const idCell = document.createElement("td");
    idCell.textContent = id;
    row.appendChild(idCell);

    dates.forEach(date => {
      const cell = document.createElement("td");
      const answer = a[date] || "";
      const isOverCapacity = maruUsers[date].length > MAX;
const isReserve = isOverCapacity && maruUsers[date].includes(id) && !highlighted[date].includes(id);
      if (highlighted[date]?.includes(id)) {cell.classList.add("highlight");}
     if (answer === "〇" && isReserve) {
    cell.textContent = "リザーバー";
  } else {
    cell.textContent = answer;
  }
      row.appendChild(cell);
    });

    const commentCell = document.createElement("td");
    commentCell.textContent = c;
    row.appendChild(commentCell);
    tbody.appendChild(row);
  });

const formRows = document.querySelectorAll("#form-body tr");
formRows.forEach(row => {
  const dateCell = row.cells[0];
  const date = dateCell.textContent;
  if (highlighted[date]?.length > 0) {
    console.log("ハイライト対象日付:", date, "ユーザー:", highlighted[date]);
    dateCell.classList.add("highlight");
  } else {
    dateCell.classList.remove("highlight");
  }
});

}

window.login = async function () {
  const id = document.getElementById("userId").value.trim();
  const pass = document.getElementById("password").value;
  if (!id || !pass) {
    document.getElementById("loginError").textContent = "IDとパスワードを入力してください。";
    return;
  }

  const docSnap = await getDoc(doc(db, "users", id));
  if (docSnap.exists()) {
    const data = docSnap.data();
    const hashedInput = await sha256(pass);
    if (data.password === hashedInput) {
      window.currentUser = id;
      window.users[id] = data;
      document.getElementById("loginSection").classList.add("hidden");
      document.getElementById("formSection").classList.remove("hidden");
      document.getElementById("resultSection").classList.remove("hidden");
      document.getElementById("welcomeMsg").textContent = `${id} さんとしてログイン中`;
try {
  const userCredential = await signInAnonymously(auth);
  const uid = userCredential.user.uid;
  window.uid = uid;
  console.log("UID取得成功", uid);
  const userRef = doc(db, "users", id);
  await setDoc(userRef, { uid }, { merge: true }); 
  console.log("UID保存成功:", uid);
} catch (error) {
  console.error("UID保存失敗:", error);
}
     
      await renderForm();
      await showAllResults();
      await loadPreviousAnswers();
      document.getElementById("loginError").textContent = "";
      document.getElementById("submitMessage").textContent = "";
    } else {
      document.getElementById("loginError").textContent = "パスワードが違います。";
    }
  } else {
    document.getElementById("loginError").textContent = "アカウントが存在しません。";
  }
};

window.register = async function () {
  const id = document.getElementById("newUserId").value.trim();
  const pass = document.getElementById("newPassword").value;
  if (!id || !pass) {
    document.getElementById("registerMessage").textContent = "名前とパスワードを入力してください。";
    return;
  }
  if (/[<>]/.test(id)) {
    document.getElementById("registerMessage").textContent = "名前に < や > を含めないでください。";
    return;
  }
  const docSnap = await getDoc(doc(db, "users", id));
  if (docSnap.exists()) {
    document.getElementById("registerMessage").textContent = "この名前はすでに使われています。";
  } else {
    const hashedPass = await sha256(pass);
    await setDoc(doc(db, "users", id), {
      password: hashedPass,
      answers: {},
      comment: ""
    });
    document.getElementById("registerMessage").style.color = "green";
    document.getElementById("registerMessage").textContent = "登録成功！ログイン画面に戻ってください。";
  }
};

window.showRegister = () => {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("registerSection").classList.remove("hidden");
};
window.backToLogin = () => {
  document.getElementById("registerSection").classList.add("hidden");
  document.getElementById("loginSection").classList.remove("hidden");
};

document.getElementById("scheduleForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!window.currentUser) return alert("ログインしてください。");

  const answerInputs = document.querySelectorAll('input[type="radio"]:checked');
  const answers = {};
  answerInputs.forEach(input => {
    const date = input.name.replace("response-", "");
    answers[date] = input.value;
  });

  const comment = document.getElementById("comment").value;
  const prevAnswers = window.users[window.currentUser]?.answers || {};
  const prevComment = window.users[window.currentUser]?.comment || "";

  const userRef = doc(db, "users", window.currentUser);
  const userSnap = await getDoc(userRef);
  const dates = await fetchCandidateDates();
  const logPromises = [];

  dates.forEach(date => {
    const oldVal = prevAnswers[date] || "";
    const newVal = answers[date] || "";
    if (oldVal !== newVal) {
      logPromises.push(addDoc(collection(db, "logs"), {
        userId: window.currentUser,
        uid: window.uid || "unknown",
        date,
        from: oldVal,
        to: newVal,
        timestamp: serverTimestamp()
      }));
    }
  });
  if (comment !== prevComment) {
    logPromises.push(addDoc(collection(db, "logs"), {
      userId: window.currentUser,
      uid: window.uid || "unknown",
      field: "comment",
      from: prevComment,
      to: comment,
      timestamp: serverTimestamp()
    }));
  }

  await Promise.all(logPromises);
  await setDoc(userRef, {
    ...window.users[window.currentUser],
    answers,
    comment,
    updatedAt: serverTimestamp()
  });

  await showAllResults();
  document.getElementById("submitMessage").textContent = "送信しました！";
});

document.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    const focusedButton = document.activeElement;
    if (focusedButton && focusedButton.tagName === 'BUTTON') {
      {
        focusedButton.click();
      }
    }
  }
});
