export const purchaseRequest = async (purchase: boolean) => {
  const response = await fetch('http://localhost:3333/purchase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ purchase }),
  });
  return response.json();
};
