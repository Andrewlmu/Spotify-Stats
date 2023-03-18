async function fetchTopArtists(timeRange) {
  try {
    const response = await fetch(`/top-artists-data?time_range=${timeRange}`);
    const topArtists = await response.json();
    displayTopArtists(topArtists);
  } catch (error) {
    console.error("Error fetching top artists:", error.message);
  }
}

function displayTopArtists(topArtists) {
  const list = document.getElementById("top-artists-list");
  list.innerHTML = "";

  topArtists.forEach((artist) => {
    const listItem = document.createElement("li");
    listItem.textContent = artist.name;
    list.appendChild(listItem);
  });
}

document
  .getElementById("short-term")
  .addEventListener("click", () => fetchTopArtists("short_term"));
document
  .getElementById("medium-term")
  .addEventListener("click", () => fetchTopArtists("medium_term"));
document
  .getElementById("long-term")
  .addEventListener("click", () => fetchTopArtists("long_term"));

// Fetch the initial data (short term)
fetchTopArtists("short_term");
