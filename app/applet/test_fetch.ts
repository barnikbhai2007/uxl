const run = async () => {
    try {
        const res = await fetch('http://localhost:3000/api/news');
        console.log(res.status);
        console.log(await res.text());
    } catch(e) {
        console.error(e);
    }
}
run();
