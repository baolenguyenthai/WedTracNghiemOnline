async function test() {
  const loginRes = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "password" })
  });
  const loginData = await loginRes.json();
  const token = loginData.data.token;

  const res = await fetch("http://localhost:4000/api/banks/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      bankName: "toán lớp 7",
      description: "toán lớp 7",
      gradeId: 1,
      subjectName: "toán lớp 7",
      isPublic: false,
      questionCount: 2,
      prompt: "toán lớp 7 hello hello hello hello hello hello hello"
    })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

test();
