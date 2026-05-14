const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}
