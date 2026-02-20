// Configuration
const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson';
const BASE_URL = "https://script.google.com/macros/s/AKfycbxkNDxrHliV-PZW8RTBTk6evdI-XRKTGltoxnbEcGfU135XFwfFNOanCXYUbCHcaQehjw/exec";

async function initMap(type, elementId) {
    const map = L.map(elementId, { 
        scrollWheelZoom: false,        // Enables mouse wheel & trackpad scroll
        touchZoom: true,              // Enables pinch-to-zoom on mobile/trackpads
        tap: true,                    // Better mobile interaction
        attributionControl: false 
    }).setView([20, 10], 2);
    // Light, clean base layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
// --- ZOOM CONTROL LOGIC ---
// Enable scroll zoom when the user clicks into the map
map.on('focus', () => {map.scrollWheelZoom.enable();});
// Disable it again when the user clicks away (blurs)
map.on('blur', () => {map.scrollWheelZoom.disable();});
    const sheetTab = (type === 'rep') ? 'RepData' : 'CommunityData';
    const fetchUrl = `${BASE_URL}?sheet=${sheetTab}`;
// --- 0. CUSTOM RESET BUTTON ---
const resetControl = L.Control.extend({
    options: { position: 'topleft' }, // Places it right under the +/- buttons
    onAdd: function (map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        const button = L.DomUtil.create('a', 'leaflet-control-reset', container);
        button.innerHTML = '🏠'; // Home icon
        button.title = 'Reset Map View';

        button.onclick = function() {
            map.setView([20, 10], 2); // Snaps back to the original world view
        };
        return container;
    }
});
map.addControl(new resetControl());
    try {
        // 1. Fetch both Google Sheet data and GeoJSON outlines simultaneously
        const [sheetResponse, geoResponse] = await Promise.all([
            fetch(fetchUrl),
            fetch(GEOJSON_URL)
        ]);

        const sheetData = await sheetResponse.json();
        const geoData = await geoResponse.json();

        // --- 1.5 GRADIENT CALCULATION (for Community Map) ---
        const counts = sheetData.map(d => parseInt(d.Count) || 0);
        const maxCount = Math.max(...counts, 1); // Avoid division by zero
        
        // 2. Define the Tinting Style
        function getStyle(feature) {
            const countryName = feature.properties.name;
            const match = sheetData.find(d => d.Country === countryName);
            
            let color = 'transparent';
            let opacity = 0;

            if (type === 'rep') {
                // Tint only if a Representative Name exists
                if (match && match.Name && match.Name.trim() !== "") {
                    color = '#003262'; // Berkeley Blue
                    opacity = 0.7;
                }
            } else {
                // Gradient for Community Map
                if (match && parseInt(match.Count) > 0) {
                    const weight = match.Count / maxCount;
                    color = '#FDB515'; // Berkeley Gold
                    opacity = 0.2 + (weight * 0.7); // Ranges from 0.2 to 0.9
                }
            }
            return {
                fillColor: match ? (type === 'rep' ? '#003262' : '#FDB515') : 'transparent',
                weight: 1,
                opacity: 1,
                color: match ? '#fff' : 'transparent',
                fillOpacity: 0.7
            };
        }

        // 3. Interaction & Popups
        L.geoJson(geoData, {
            style: getStyle,
            onEachFeature: (feature, layer) => {
                const match = sheetData.find(d => d.Country === feature.properties.name);
                if (match && (type === 'community' || (match.Name && match.Name.trim() !== ""))) {
                    let content = `<strong>${feature.properties.name}</strong>`;
                    if (type === 'rep') {
                        content = `
                            <div style="text-align:center; min-width:150px;">
                                <img src="${match.PhotoURL}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; margin-bottom:8px; border:1px solid #ddd;">
                                <br><strong>${match.Name}</strong><br>
                                <small>${match.Institution}</small><br>
                                <a href="mailto:${match.Email}" style="color:#003262; font-size:11px;">${match.Email}</a>
                            </div>`;
                    } else {
                        content += `<br>${match.Count} Participants`;
                    }
                    layer.bindPopup(content);
                }
            }
        }).addTo(map);
// --- 4. UNIVERSAL MARKER FALLBACK (For Singapore, HK, etc.) ---
sheetData.forEach(match => {
    // Only proceed if Lat and Long are provided in the sheet
    if (match.Lat && match.Long) {
        
        // 1. Determine color and content based on map type
        const markerColor = (type === 'rep') ? '#003262' : '#FDB515';
        let content = `<strong>${match.Country}</strong>`;

        if (type === 'rep' && match.Name) {
            content = `
                <div style="text-align:center; min-width:150px;">
                    <img src="${match.PhotoURL}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; margin-bottom:8px; border:1px solid #ddd;">
                    <br><strong>${match.Name}</strong><br>
                    <small>${match.Institution}</small><br>
                    <a href="mailto:${match.Email}" style="color:#003262; font-size:11px;">${match.Email}</a>
                </div>`;
        } else if (type === 'community' && match.Count) {
            content += `<br>${match.Count} Participants`;
        }

        // 2. Create and add the marker to the map
        const marker = L.circleMarker([match.Lat, match.Long], {
            radius: (type === 'rep') ? 6 : 5, // Rep markers slightly larger
            fillColor: markerColor,
            color: '#fff',
            weight: 1,
            fillOpacity: 1
        }).addTo(map);

        marker.bindPopup(content);
    }
});
        // --- 5. SEARCH FUNCTIONALITY ---
const searchInput = document.getElementById('mapSearch');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const resultsDiv = document.getElementById('searchResults');
        resultsDiv.innerHTML = ''; // Clear old results

        if (query.length < 2) return; // Don't search until 2 characters are typed

        // Filter countries that match the search
        const matches = sheetData.filter(d => d.Country.toLowerCase().includes(query));

        matches.forEach(match => {
            const div = document.createElement('div');
            div.style.padding = '10px';
            div.style.cursor = 'pointer';
            div.style.borderBottom = '1px solid #eee';
            div.innerText = match.Country;

            div.onclick = () => {
                // Find the layer on the map that matches this country
                map.eachLayer(layer => {
                    // Check if it's a GeoJSON shape or a Marker
                    if (layer.feature && layer.feature.properties.name === match.Country) {
                        map.fitBounds(layer.getBounds());
                        layer.openPopup();
                    } else if (layer.getLatLng && match.Lat) {
                        // If it's a city-state marker
                        if (layer.getLatLng().lat == match.Lat) {
                            map.setView(layer.getLatLng(), 6);
                            layer.openPopup();
                        }
                    }
                });
                resultsDiv.innerHTML = '';
                searchInput.value = match.Country;
            };
            resultsDiv.appendChild(div);
        });
    });
}

    } catch (error) {
        console.error("Error loading map data:", error);
    }
}
// --- GLOBAL SEARCH CLEANUP ---
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        const results = document.getElementById('searchResults');
        const searchInput = document.getElementById('mapSearch');
        
        if (results) results.innerHTML = '';
        if (searchInput) {
            searchInput.value = '';
            searchInput.blur(); // Removes focus from the input box
        }
    }
});
// Initialize based on which div is found on the page
if (document.getElementById('communityMap')) initMap('community', 'communityMap');
if (document.getElementById('repMap')) initMap('rep', 'repMap');
