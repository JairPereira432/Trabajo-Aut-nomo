// =================================================================
// 1. CONSTANTES GLOBALES Y ELEMENTOS DEL DOM
// =================================================================

const API_BASE_URL = 'https://www.cheapshark.com/api/1.0/'; 

// Elementos del DOM
const gridContainer = document.getElementById('games-grid');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessage = document.getElementById('error-message');
const loadMoreButton = document.getElementById('load-more-button');
const storeFilterSelect = document.getElementById('store-filter');
const sortSelect = document.getElementById('sort-by-price');
const searchButton = document.getElementById('search-button');
const searchInput = document.getElementById('search-input');

// Elementos del Modal
const detailModal = document.getElementById('detail-modal');
const closeModalButton = document.getElementById('close-modal');
const modalTitle = document.getElementById('modal-game-title');
const modalContentContainer = document.getElementById('modal-content-container');

// Parámetros de consulta
let currentPage = 0;
let currentSearch = '';
let currentStoreID = '';
let currentSortBy = '';

// =================================================================
// 2. FUNCIONES DE UTILIDAD DE LA INTERFAZ (UI)
// =================================================================

function toggleLoading(isVisible) {
    loadingIndicator.classList.toggle('hidden', !isVisible); 
}

function toggleError(isVisible) {
    errorMessage.classList.toggle('hidden', !isVisible); 
}

function clearGrid() {
    gridContainer.innerHTML = '';
}

// =================================================================
// 3. MAPPING Y RENDERIZADO (Render Dinámico)
// =================================================================

/** Mapea el formato de /games (búsqueda) al formato de /deals. */
function mapGameToDealFormat(games) {
    if (!games || games.length === 0) return [];
    
    return games.map(game => {
        return {
            title: game.external, 
            thumb: game.thumb,
            salePrice: game.cheapest, 
            normalPrice: game.cheapestPriceEver ? game.cheapestPriceEver.price : game.cheapest, 
            dealID: game.cheapestDealID,
        };
    });
}

/** Genera el HTML de una tarjeta de videojuego (ESTILO MODERNO Y LEGIBLE). */
function createGameCardHTML(deal) {
    const normal = parseFloat(deal.normalPrice);
    const sale = parseFloat(deal.salePrice);
    const savings = normal > 0 ? ((normal - sale) / normal) * 100 : 0;
    
    const isDealValid = deal.dealID && typeof deal.dealID === 'string' && deal.dealID.length > 5;

    return `
        <article class="bg-gray-800 rounded-xl shadow-xl hover:shadow-2xl transition-all overflow-hidden border border-gray-700 transform hover:scale-[1.02]">
            <img src="${deal.thumb}" alt="${deal.title}" class="w-full h-48 object-cover">
            <div class="p-5">
                <h3 class="text-xl font-bold text-indigo-300 truncate mb-3" title="${deal.title}">${deal.title}</h3>
                
                <div class="flex justify-between items-center mt-3">
                    ${savings > 0 ? 
                        `<span class="text-sm font-bold px-3 py-1 rounded-full bg-red-600 text-white">${savings.toFixed(0)}% OFF</span>`
                        : `<span class="text-sm font-bold px-3 py-1 rounded-full bg-gray-600 text-white">Precio Completo</span>`
                    }
                    <div class="text-right">
                        ${savings > 0 ? 
                            `<p class="text-base text-gray-400 line-through">$${deal.normalPrice}</p>`
                            : `<p class="text-base text-gray-400">Precio</p>`
                        }
                        <p class="text-3xl font-extrabold text-green-400">$${deal.salePrice}</p> 
                    </div>
                </div>
                
                ${isDealValid ? 
                    `<button data-deal-id="${deal.dealID}" 
                                class="view-detail-btn w-full mt-5 bg-indigo-600 text-white py-3 rounded-lg shadow-md hover:bg-indigo-500 transition-colors font-semibold">
                        Ver Detalles
                    </button>`
                    : 
                    `<button disabled 
                                class="w-full mt-5 bg-gray-600 text-white py-3 rounded-lg cursor-not-allowed">
                        Detalle no disponible
                    </button>`
                }
            </div>
        </article>
    `;
}

/** Renderiza la lista de tarjetas de videojuegos en el DOM. */
function renderGameDeals(deals, append = false) {
    if (!append) { clearGrid(); loadMoreButton.classList.add('hidden'); }

    if (deals && deals.length > 0) {
        const html = deals.map(createGameCardHTML).join('');
        gridContainer.insertAdjacentHTML('beforeend', html);
        
        document.querySelectorAll('.view-detail-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const dealID = e.currentTarget.dataset.dealId;
                if (dealID) showDetailModal(dealID);
            });
        });

    } else if (!append) {
        gridContainer.innerHTML = '<p class="col-span-full text-center text-2xl text-gray-400 p-10">No se encontraron ofertas. ¡Explora más!</p>';
    }
    
    if (!currentSearch && deals && deals.length === 20) { 
        loadMoreButton.classList.remove('hidden');
    }
}

// =================================================================
// 4. LÓGICA DE LA API (Async/Await y Try/Catch)
// =================================================================

async function fetchDeals(isInitialLoad = true) {
    if (isInitialLoad) { currentPage = 0; clearGrid(); loadMoreButton.classList.add('hidden'); }

    toggleError(false);
    toggleLoading(true);

    let endpoint = '';
    let params = {};

    if (currentSearch) {
        endpoint = 'games?';
        params = { title: currentSearch, limit: '20' }; 
        currentStoreID = '';
        storeFilterSelect.value = ''; 
    } else {
        endpoint = 'deals?';
        params = {
            storeID: currentStoreID || '1',
            pageSize: '20', 
            pageNumber: currentPage,
            sortBy: currentSortBy || 'DealRating'
        };
    }

    try {
        const url = API_BASE_URL + endpoint + new URLSearchParams(params);
        const response = await fetch(url); 

        if (!response.ok) { 
             throw new Error('La API respondió con un estado HTTP ' + response.status); 
        }

        const data = await response.json();
        
        const processedDeals = currentSearch 
            ? mapGameToDealFormat(data) 
            : data; 
        
        renderGameDeals(processedDeals, !isInitialLoad); 

    } catch (error) {
        console.error("Error al obtener datos:", error);
        toggleError(true);
        loadMoreButton.classList.add('hidden');
    } finally {
        toggleLoading(false);
    }
}


async function fetchStores() {
    const storesURL = API_BASE_URL + 'stores';
    
    try {
        const response = await fetch(storesURL);
        if (!response.ok) { throw new Error('Error al obtener tiendas: ' + response.status); }
        const stores = await response.json();
        
        stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.storeID;
            option.textContent = store.storeName;
            storeFilterSelect.appendChild(option);
        });

    } catch (error) {
        console.error("No se pudo cargar la lista de tiendas:", error);
    }
}

/** Muestra el modal de detalle (con botón de compra ajustado para ser igual a 'Ver Detalles'). */
async function showDetailModal(dealID) {
    if (!dealID || typeof dealID !== 'string' || dealID.length < 5) {
        console.error("Deal ID inválido o nulo:", dealID);
        return; 
    }

    modalTitle.textContent = "Cargando Detalle...";
    modalContentContainer.innerHTML = '<p class="text-center text-gray-400 p-8">Preparando detalles...</p>';
    detailModal.classList.remove('hidden');

    try {
        const detailURL = `${API_BASE_URL}deals?id=${dealID}`; 
        const response = await fetch(detailURL);
        
        if (!response.ok) { throw new Error('Error de HTTP: ' + response.status); }
        
        const data = await response.json();
        
        const dealData = data; 
        
        if (!dealData || !dealData.gameInfo) {
            throw new Error('No se pudo encontrar la información del juego en la respuesta de la API.');
        }

        const deal = dealData.gameInfo;
        
        modalTitle.textContent = deal.name;
        
        // Botón de compra ajustado para coincidir con 'Ver Detalles' (py-2, rounded-md, w-full, shadow-md)
        modalContentContainer.innerHTML = `
            <div class="flex flex-col md:flex-row gap-6 items-center md:items-start">
                <img src="${deal.thumb}" alt="${deal.name}" class="w-full md:w-1/3 h-auto object-cover rounded-xl shadow-lg border-2 border-indigo-600">
                <div class="md:w-2/3 flex flex-col justify-between"> 
                    <div> 
                        <p class="text-lg text-gray-300">Precio Normal: <span class="line-through text-red-400 font-semibold">$${deal.retailPrice}</span></p>
                        <p class="text-4xl font-extrabold text-green-400 my-3">
                            Oferta: $${deal.salePrice}
                        </p>
                        <p class="text-md text-gray-400 mb-4">Metacritic Score: <span class="font-bold">${deal.metacriticScore || 'N/A'}</span></p>
                    </div>
                    
                    <a href="https://www.cheapshark.com/redirect?dealID=${dealID}" target="_blank"
                       class="inline-block bg-indigo-600 text-white **py-3** rounded-lg **shadow-md** hover:bg-indigo-500 transition-all **font-semibold** **w-full** **mt-4** text-center">
                        ¡Comprar ahora!
                    </a>
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Error al mostrar modal:", error); 
        modalTitle.textContent = "Error";
        modalContentContainer.innerHTML = '<p class="text-center text-red-400 p-8">No se pudo cargar el detalle del juego. ¡Intenta de nuevo!</p>'; 
    }
}


// =================================================================
// 5. EVENT LISTENERS
// =================================================================

searchButton.addEventListener('click', () => {
    currentSearch = searchInput.value.trim();
    fetchDeals(true); 
});

sortSelect.addEventListener('change', (e) => {
    currentSortBy = e.target.value;
    currentSearch = ''; 
    searchInput.value = '';
    fetchDeals(true); 
});

storeFilterSelect.addEventListener('change', (e) => {
    currentStoreID = e.target.value;
    currentSearch = ''; 
    searchInput.value = '';
    fetchDeals(true); 
});

loadMoreButton.addEventListener('click', () => {
    currentPage++;
    fetchDeals(false); 
});

closeModalButton.addEventListener('click', () => {
    detailModal.classList.add('hidden');
});

// =================================================================
// 6. INICIALIZACIÓN
// =================================================================

function init() {
    fetchDeals(); // Carga inicial
    fetchStores(); // Cargar filtros
}

init();