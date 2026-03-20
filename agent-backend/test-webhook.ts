// test-webhook.ts
const response = await fetch("http://localhost:3001/webhook", {
    method: "POST",
    body: JSON.stringify({
        deliveryId: "ORDER_99",
        amount: 0.01,
        recipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Local Hardhat Address
        status: "completed"
    }),
});

console.log(await response.json());