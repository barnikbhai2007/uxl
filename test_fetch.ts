const run = async () => {
    try {
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({email: "admin@uxl.com", password: "admin123"})
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        const res2 = await fetch('http://localhost:3000/api/db/get', {
            method: 'POST',
            headers: {'content-type': 'application/json', 'Authorization': 'Bearer ' + token},
            body: JSON.stringify({collection: "test", id: "1"})
        });
        console.log("Status DB:", res2.status);
        console.log("Response DB:", await res2.text());
    } catch(e) {
        console.error(e);
    }
}
run();
