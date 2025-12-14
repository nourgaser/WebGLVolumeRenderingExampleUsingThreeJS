async function loadShader(url) {
  const response = await fetch(url);
  return await response.text();
}

export default loadShader;