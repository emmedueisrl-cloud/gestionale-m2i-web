const test = async () => {
  const res = await fetch('http://localhost:5173/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ functionName: 'caricaKpiDashboard', args: [] })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
