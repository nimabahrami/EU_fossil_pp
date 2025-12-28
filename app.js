// Global state
let map, allPlants = [], filteredPlants = [], markers = [];
let selectedFilters = { countries: [], fuels: [], suppliers: [], minCap: 20, maxCap: 5000 };
let charts = {};
let maxCapacityInData = 5000;

// Enhanced supplier financial data
const supplierData = {
    'Siemens': {
        revenue: '€62.0B', employees: '293,000', founded: 1847, headquarters: 'Munich, Germany',
        ebitda: '€7.9B', cashFlow: '€5.2B', pe: '15.2', liquidity: '1.8', roe: '12.3%', debt: '€23.1B'
    },
    'GE': {
        revenue: '$74.2B', employees: '172,000', founded: 1892, headquarters: 'Boston, USA',
        ebitda: '$8.5B', cashFlow: '$6.1B', pe: '18.7', liquidity: '1.6', roe: '9.8%', debt: '$38.4B'
    },
    'Alstom': {
        revenue: '€15.5B', employees: '74,000', founded: 1928, headquarters: 'Paris, France',
        ebitda: '€1.2B', cashFlow: '€0.8B', pe: '22.1', liquidity: '2.1', roe: '8.5%', debt: '€6.2B'
    },
    'Mitsubishi Hitachi': {
        revenue: '¥4.2T', employees: '80,000', founded: 2014, headquarters: 'Tokyo, Japan',
        ebitda: '¥480B', cashFlow: '¥320B', pe: '14.3', liquidity: '1.9', roe: '11.2%', debt: '¥1.8T'
    },
    'Ansaldo Energia': {
        revenue: '€1.2B', employees: '3,400', founded: 1853, headquarters: 'Genoa, Italy',
        ebitda: '€95M', cashFlow: '€62M', pe: 'N/A', liquidity: '1.4', roe: '6.2%', debt: '€420M'
    },
    'Doosan Skoda': {
        revenue: '~€800M', employees: '3,000', founded: 1859, headquarters: 'Plzeň, Czech Republic',
        ebitda: '€72M', cashFlow: '€48M', pe: 'N/A', liquidity: '1.3', roe: '7.8%', debt: '€280M'
    }
};

function initMap() {
    map = L.map('map', { zoomControl: false }).setView([50.5, 10.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 20
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
}

function loadData() {
    fetch('./eu_fossil_powerplants_with_suppliers.csv')
        .then(response => response.text())
        .then(csvText => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: function (results) {
                    // Filter plants with valid coordinates and capacity >= 20
                    allPlants = results.data.filter(p => {
                        const lat = parseFloat(p.lat);
                        const lon = parseFloat(p.lon);
                        const cap = parseFloat(p.capacity);
                        return lat && lon && !isNaN(lat) && !isNaN(lon) && cap >= 20;
                    });

                    console.log('Loaded plants:', allPlants.length);

                    // Calculate actual max capacity
                    maxCapacityInData = Math.max(...allPlants.map(p => parseFloat(p.capacity) || 0));
                    maxCapacityInData = Math.ceil(maxCapacityInData / 100) * 100; // Round up to nearest 100

                    console.log('Max capacity in data:', maxCapacityInData);

                    selectedFilters.maxCap = maxCapacityInData;

                    filteredPlants = [...allPlants];

                    initFilters();
                    createLegend();
                    updateDisplay();
                    updateStats();
                    createCharts();
                }
            });
        })
        .catch(error => console.error('Error:', error));
}

function createLegend() {
    const fuels = {
        'Natural gas': '#7aa2f7',
        'Hard coal': '#565f89',
        'Lignite': '#e0af68',
        'Oil': '#bb9af7',
        'Mixed fossil fuels': '#f7768e'
    };

    const legendHTML = `
        <h4>Fuel Types</h4>
        ${Object.entries(fuels).map(([fuel, color]) => `
            <div class="legend-item">
                <div class="legend-color" style="background: ${color}; color: ${color};"></div>
                <span>${fuel}</span>
            </div>
        `).join('')}
    `;

    document.querySelector('.fuel-legend').innerHTML = legendHTML;
}

function initFilters() {
    const countries = [...new Set(allPlants.map(p => p.country))].sort();
    const fuels = [...new Set(allPlants.map(p => p.energy_source))].filter(f => f).sort();
    const suppliers = [...new Set(allPlants.flatMap(p =>
        p.Supplier ? p.Supplier.split(';').map(s => s.trim()) : []
    ))].filter(s => s && s !== 'Unknown').sort();

    createCustomSelect('countryOptions', countries, 'countries');
    createCustomSelect('fuelOptions', fuels, 'fuels');
    createCustomSelect('supplierOptions', suppliers, 'suppliers');

    document.querySelectorAll('.select-trigger').forEach(trigger => {
        trigger.addEventListener('click', function () {
            const options = this.nextElementSibling;
            document.querySelectorAll('.select-options').forEach(o => {
                if (o !== options) o.classList.remove('active');
            });
            options.classList.toggle('active');
        });
    });

    const minCap = document.getElementById('minCapacity');
    const maxCap = document.getElementById('maxCapacity');

    // Set proper min/max values
    minCap.min = 20;
    minCap.max = maxCapacityInData;
    minCap.value = 20;
    maxCap.min = 20;
    maxCap.max = maxCapacityInData;
    maxCap.value = maxCapacityInData;

    // Add slider track and range elements
    const slider = document.querySelector('.range-slider');
    if (!slider.querySelector('.slider-track')) {
        slider.insertAdjacentHTML('afterbegin', '<div class="slider-track"></div><div class="slider-range"></div>');
    }

    function updateSlider() {
        const min = parseInt(minCap.value);
        const max = parseInt(maxCap.value);
        const rangeEl = slider.querySelector('.slider-range');

        const totalRange = maxCapacityInData - 20;
        const minPos = ((min - 20) / totalRange) * 100;
        const maxPos = ((max - 20) / totalRange) * 100;

        rangeEl.style.left = `calc(1rem + ${minPos}% * (100% - 2rem) / 100)`;
        rangeEl.style.width = `calc((${maxPos - minPos}%) * (100% - 2rem) / 100)`;

        selectedFilters.minCap = min;
        selectedFilters.maxCap = max;
        document.getElementById('capacityValue').textContent = `${min} - ${max}`;
    }

    minCap.addEventListener('input', () => {
        const minVal = parseInt(minCap.value);
        const maxVal = parseInt(maxCap.value);
        if (minVal > maxVal) minCap.value = maxVal;
        updateSlider();
    });

    maxCap.addEventListener('input', () => {
        const minVal = parseInt(minCap.value);
        const maxVal = parseInt(maxCap.value);
        if (maxVal < minVal) maxCap.value = minVal;
        updateSlider();
    });

    // Apply filters when slider is released
    minCap.addEventListener('change', () => {
        console.log('Applying filters - min:', selectedFilters.minCap, 'max:', selectedFilters.maxCap);
        applyFilters();
    });
    maxCap.addEventListener('change', () => {
        console.log('Applying filters - min:', selectedFilters.minCap, 'max:', selectedFilters.maxCap);
        applyFilters();
    });

    updateSlider();

    document.getElementById('clearFilters').addEventListener('click', () => {
        selectedFilters = { countries: [], fuels: [], suppliers: [], minCap: 20, maxCap: maxCapacityInData };
        document.querySelectorAll('.select-option input').forEach(cb => cb.checked = false);
        minCap.value = 20;
        maxCap.value = maxCapacityInData;
        updateSlider();
        applyFilters();
    });

    document.getElementById('searchInput').addEventListener('input', (e) => applyFilters(e.target.value.toLowerCase()));
}

function createCustomSelect(containerId, items, filterKey) {
    const container = document.getElementById(containerId);
    container.innerHTML = items.map(item => `
        <label class="select-option">
            <input type="checkbox" value="${item}" data-filter="${filterKey}">
            <span>${item}</span>
        </label>
    `).join('');

    container.querySelectorAll('input').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedFilters[filterKey].push(e.target.value);
            } else {
                selectedFilters[filterKey] = selectedFilters[filterKey].filter(v => v !== e.target.value);
            }
            applyFilters();
        });
    });
}

function applyFilters(searchQuery = '') {
    console.log('Applying filters with capacity:', selectedFilters.minCap, '-', selectedFilters.maxCap);

    filteredPlants = allPlants.filter(plant => {
        const matchCountry = selectedFilters.countries.length === 0 || selectedFilters.countries.includes(plant.country);
        const matchFuel = selectedFilters.fuels.length === 0 || selectedFilters.fuels.includes(plant.energy_source);

        const capacity = parseFloat(plant.capacity) || 0;
        const matchCapacity = capacity >= selectedFilters.minCap && capacity <= selectedFilters.maxCap;

        let matchSupplier = selectedFilters.suppliers.length === 0;
        if (selectedFilters.suppliers.length > 0 && plant.Supplier) {
            const plantSuppliers = plant.Supplier.split(';').map(s => s.trim());
            matchSupplier = selectedFilters.suppliers.some(s => plantSuppliers.includes(s));
        }

        const matchSearch = !searchQuery ||
            plant.name.toLowerCase().includes(searchQuery) ||
            (plant.country && plant.country.toLowerCase().includes(searchQuery));

        return matchCountry && matchFuel && matchCapacity && matchSupplier && matchSearch;
    });

    console.log('Filtered plants:', filteredPlants.length);

    updateDisplay();
    updateStats();
    updateCharts();
}

function updateDisplay() {
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    // Add markers for filtered plants
    filteredPlants.forEach(plant => {
        const marker = createMarker(plant);
        marker.addTo(map);
        markers.push(marker);
    });

    // Update plant list
    const plantList = document.getElementById('plantList');
    plantList.innerHTML = filteredPlants.slice(0, 50).map(plant => `
        <div class="plant-item" data-lat="${plant.lat}" data-lon="${plant.lon}">
            <div class="plant-item-header">
                <div class="plant-icon">${getFuelIcon(plant.energy_source)}</div>
                <div class="plant-info">
                    <h4>${plant.name || 'Unknown'}</h4>
                    <p>${plant.country || 'N/A'} • ${plant.capacity || '0'} MW</p>
                </div>
            </div>
        </div>
    `).join('');

    plantList.querySelectorAll('.plant-item').forEach(item => {
        item.addEventListener('click', () => {
            map.setView([parseFloat(item.dataset.lat), parseFloat(item.dataset.lon)], 12);
        });
    });
}

function createMarker(plant) {
    const lat = parseFloat(plant.lat);
    const lon = parseFloat(plant.lon);
    const capacity = parseFloat(plant.capacity) || 0;
    const size = Math.min(Math.max(capacity / 80, 8), 22);
    const color = getFuelColor(plant.energy_source);

    // Create marker with radial gradient effect
    const marker = L.circleMarker([lat, lon], {
        radius: size,
        fillColor: color,
        color: color,
        weight: 0,
        opacity: 1,
        fillOpacity: 0.7
    });

    // Apply radial blur effect via custom pane/renderer
    marker.on('add', function () {
        const path = this._path;
        if (path) {
            path.style.filter = 'blur(1.5px)';
            path.style.background = `radial-gradient(circle, ${color} 0%, ${color} 50%, transparent 100%)`;
        }
    });

    marker.bindPopup(createPopupContent(plant), { maxWidth: 320, className: 'custom-popup' });
    return marker;
}

function createPopupContent(plant) {
    const suppliers = plant.Supplier ? plant.Supplier.split(';').map(s => s.trim()) : ['Unknown'];
    return `
        <div class="popup-header">
            <h3>${plant.name || 'Unknown Plant'}</h3>
            <div class="popup-meta">
                <span>${getFuelIcon(plant.energy_source)} ${plant.energy_source || 'Unknown'}</span>
                <span>📍 ${plant.country || 'N/A'}</span>
            </div>
        </div>
        <div class="popup-body">
            <div class="popup-detail">
                <span class="popup-detail-label">Capacity</span>
                <span class="popup-detail-value">${plant.capacity || '0'} MW</span>
            </div>
            <div class="popup-detail">
                <span class="popup-detail-label">Technology</span>
                <span class="popup-detail-value">${plant.technology || 'N/A'}</span>
            </div>
            <div class="popup-detail">
                <span class="popup-detail-label">Operator</span>
                <span class="popup-detail-value">${plant.company || 'N/A'}</span>
            </div>
            <div class="popup-detail">
                <span class="popup-detail-label">Supplier(s)</span>
                <span class="popup-detail-value">${suppliers.join(', ')}</span>
            </div>
        </div>
        ${suppliers[0] !== 'Unknown' ? `
            <div class="popup-actions">
                <button class="btn-supplier" onclick="showSupplierDetails('${suppliers[0]}')">
                    View ${suppliers[0]} Financials
                </button>
            </div>
        ` : ''}
    `;
}

window.showSupplierDetails = function (supplierName) {
    const modal = document.getElementById('supplierModal');
    const data = supplierData[supplierName] || { revenue: 'N/A', employees: 'N/A', founded: 'N/A', headquarters: 'N/A', ebitda: 'N/A', cashFlow: 'N/A', pe: 'N/A', liquidity: 'N/A', roe: 'N/A', debt: 'N/A' };

    document.getElementById('supplierDetails').innerHTML = `
        <div style="padding: 2rem;">
            <h2 style="font-size: 1.75rem; margin-bottom: 0.5rem; color: var(--accent);">${supplierName}</h2>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">Power Generation Equipment Manufacturer</p>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">Revenue</div>
                    <div style="font-size: 1.75rem; font-weight: 700; color: var(--success);">${data.revenue}</div>
                </div>
                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">EBITDA</div>
                    <div style="font-size: 1.75rem; font-weight: 700; color: var(--accent);">${data.ebitda}</div>
                </div>
                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">Cash Flow</div>
                    <div style="font-size: 1.75rem; font-weight: 700; color: var(--warning);">${data.cashFlow}</div>
                </div>
                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">P/E Ratio</div>
                    <div style="font-size: 1.75rem; font-weight: 700;">${data.pe}</div>
                </div>
                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">Liquidity Ratio</div>
                    <div style="font-size: 1.75rem; font-weight: 700; color: ${parseFloat(data.liquidity) > 1.5 ? 'var(--success)' : 'var(--danger)'};">${data.liquidity}</div>
                </div>
                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">ROE</div>
                    <div style="font-size: 1.75rem; font-weight: 700; color: var(--success);">${data.roe}</div>
                </div>
                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">Total Debt</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger);">${data.debt}</div>
                </div>
                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">Employees</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${data.employees}</div>
                </div>
                <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">Founded</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${data.founded}</div>
                </div>
            </div>
            
            <div style="background: linear-gradient(135deg, rgba(58, 166, 255, 0.1), rgba(58, 166, 255, 0.05)); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(58, 166, 255, 0.2);">
                <h3 style="font-size: 1.1rem; margin-bottom: 0.75rem; color: var(--accent);">📍 ${data.headquarters}</h3>
                <p style="color: var(--text-secondary); line-height: 1.6; margin: 0;">
                    ${supplierName} is a leading global supplier of power generation equipment, specializing in turbines, generators, and complete power island solutions for fossil fuel and renewable energy plants.
                </p>
            </div>
        </div>
    `;
    modal.classList.add('active');
};

document.querySelector('.modal-close').addEventListener('click', () => {
    document.getElementById('supplierModal').classList.remove('active');
});

function updateStats() {
    const totalCapacity = filteredPlants.reduce((sum, p) => sum + (parseFloat(p.capacity) || 0), 0);
    const countries = [...new Set(filteredPlants.map(p => p.country))];
    const suppliers = [...new Set(filteredPlants.flatMap(p =>
        p.Supplier ? p.Supplier.split(';').map(s => s.trim()) : []
    ))].filter(s => s && s !== 'Unknown');

    document.getElementById('statTotal').textContent = filteredPlants.length;
    document.getElementById('statCapacity').textContent = (totalCapacity / 1000).toFixed(1) + ' GW';
    document.getElementById('statCountries').textContent = countries.length;
    document.getElementById('statSuppliers').textContent = suppliers.length;
}

function createCharts() {
    Chart.defaults.color = '#8b949e';
    Chart.defaults.borderColor = '#2d3436';

    // Vibrant gradient colors matching green theme
    const chartColors = [
        'rgba(0, 255, 65, 0.8)',    // Neon green
        'rgba(116, 185, 255, 0.8)', // Blue
        'rgba(162, 155, 254, 0.8)', // Purple
        'rgba(255, 215, 0, 0.8)',   // Gold
        'rgba(255, 71, 87, 0.8)',   // Red
        'rgba(253, 121, 168, 0.8)', // Pink
        'rgba(0, 204, 52, 0.8)',    // Dark green
        'rgba(255, 153, 0, 0.8)'    // Orange
    ];

    // Country chart
    const countryData = {};
    filteredPlants.forEach(p => countryData[p.country] = (countryData[p.country] || 0) + 1);
    const topCountries = Object.entries(countryData).sort((a, b) => b[1] - a[1]).slice(0, 10);

    charts.country = new Chart(document.getElementById('countryChart'), {
        type: 'bar',
        data: {
            labels: topCountries.map(([c]) => c),
            datasets: [{
                data: topCountries.map(([, v]) => v),
                backgroundColor: chartColors,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(45, 52, 54, 0.5)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Capacity histogram
    const capacityBuckets = [20, 100, 200, 500, 1000, 2000, 5000];
    const capacityData = capacityBuckets.map((min, i) => {
        const max = capacityBuckets[i + 1] || Infinity;
        return filteredPlants.filter(p => {
            const cap = parseFloat(p.capacity) || 0;
            return cap >= min && cap < max;
        }).length;
    });

    charts.capacity = new Chart(document.getElementById('capacityChart'), {
        type: 'bar',
        data: {
            labels: ['20-100', '100-200', '200-500', '500-1000', '1000-2000', '2000+'],
            datasets: [{
                label: 'Plants',
                data: capacityData.slice(0, -1),
                backgroundColor: chartColors,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(45, 52, 54, 0.5)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Fuel type chart
    const fuelData = {};
    filteredPlants.forEach(p => fuelData[p.energy_source] = (fuelData[p.energy_source] || 0) + 1);

    charts.fuel = new Chart(document.getElementById('fuelChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(fuelData),
            datasets: [{
                data: Object.values(fuelData),
                backgroundColor: chartColors,
                borderWidth: 2,
                borderColor: '#0a0e13'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#e6e6e6' } }
            }
        }
    });

    // Supplier chart
    const supplierData = {};
    filteredPlants.forEach(p => {
        if (p.Supplier) {
            p.Supplier.split(';').forEach(s => {
                const supplier = s.trim();
                if (supplier !== 'Unknown') supplierData[supplier] = (supplierData[supplier] || 0) + 1;
            });
        }
    });
    const topSuppliers = Object.entries(supplierData).sort((a, b) => b[1] - a[1]).slice(0, 8);

    charts.supplier = new Chart(document.getElementById('supplierChart'), {
        type: 'bar',
        data: {
            labels: topSuppliers.map(([s]) => s),
            datasets: [{
                data: topSuppliers.map(([, v]) => v),
                backgroundColor: chartColors,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(45, 52, 54, 0.5)' } },
                y: { grid: { display: false } }
            }
        }
    });
}

function updateCharts() {
    if (charts.country) {
        Object.values(charts).forEach(chart => chart.destroy());
    }
    createCharts();
}

function getFuelColor(fuel) {
    const colors = {
        'Natural gas': '#7aa2f7',  // Blue
        'Hard coal': '#565f89',     // Dark gray
        'Lignite': '#e0af68',       // Orange/yellow
        'Oil': '#bb9af7',           // Purple
        'Mixed fossil fuels': '#f7768e',  // Red/pink
        'Non-renewable waste': '#ff9e64'  // Orange
    };
    return colors[fuel] || '#9ece6a';  // Green fallback
}

function getFuelIcon(fuel) {
    const icons = {
        'Natural gas': '🔥',
        'Hard coal': '⚫',
        'Lignite': '🟤',
        'Oil': '🛢️',
        'Mixed fossil fuels': '⚡',
        'Non-renewable waste': '♻️'
    };
    return icons[fuel] || '⚡';
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('App initializing...');
    initMap();
    loadData();

    // Sidebar toggle for mobile
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target) && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                }
            }
        });
    }
});
