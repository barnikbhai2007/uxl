const run = async () => {
    try {
        const res = await fetch('http://localhost:3000/api/news');
        console.log("Status:", res.status);
        console.log("Response:", await res.text());
        
        const res2 = await fetch('http://localhost:3000/api/db/get', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({collection: "test", id: "1"})
        });
        console.log("Status DB:", res2.status);
        console.log("Response DB:", await res2.text());
    } catch(e) {
        console.error(e);
    }
}
run();
