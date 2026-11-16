"use strict";

const serviceSelect  = document.getElementById('serviceSelect');
const serviceInfo    = document.getElementById('serviceInfo');
const serviceName    = document.getElementById('serviceName');
const serviceDetails = document.getElementById('serviceDetails');
const genreBar       = document.getElementById('genreBar');
const mainContent    = document.getElementById('mainContent');
const moviesHeading  = document.getElementById('moviesHeading');
const moviesList     = document.getElementById('moviesList');
const orderSummary   = document.getElementById('orderSummary');

let selectedService = null;
let selectedGenre = 'All';
let order = {};

const serviceFeeCache = {};

// streamingServicesData is injected by the server into the PUG page
streamingServicesData.forEach(service => {
    order[service.name] = [];
    serviceFeeCache[service.name]          = service.serviceFee;
    serviceFeeCache[service.name + '_min'] = service.minOrder;
});

// fetch full service data when dropdown changes
serviceSelect.addEventListener('change', () => {
    const serviceId = parseInt(serviceSelect.value);
    if (!serviceId) return;

    fetch('/services/' + serviceId, {
        headers: { 'Accept': 'application/json' }
    })
        .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(data => {
            selectedService = data;
            selectedGenre   = 'All';

            if (!order[selectedService.name]) {
                order[selectedService.name] = [];
            }

            serviceInfo.classList.remove('hidden');
            serviceName.textContent    = selectedService.name;
            serviceDetails.textContent =
                'Minimum Order: $' + selectedService.minOrder.toFixed(2) +
                ' | Service Fee: $' + selectedService.serviceFee.toFixed(2);

            genreBar.classList.remove('hidden');
            mainContent.classList.remove('hidden');

            renderGenres();
            renderMovies();
            renderOrder();
        })
        .catch(err => console.error('Failed to load service data:', err));
});

// renders genre filter buttons
function renderGenres() {
    genreBar.innerHTML = '';
    const genres = ['All', ...Object.keys(selectedService.genres)];

    genres.forEach(genre => {
        const span = document.createElement('span');
        span.textContent = genre;
        span.className   = 'genre';
        if (genre === selectedGenre) span.classList.add('active');

        span.addEventListener('click', () => {
            selectedGenre = genre;
            renderGenres();
            renderMovies();
        });

        genreBar.appendChild(span);
    });
}

// renders movie list for the selected genre
function renderMovies() {
    moviesList.innerHTML = '';
    moviesHeading.textContent =
        selectedGenre === 'All' ? 'All Movies' : selectedGenre + ' Movies';

    let movies = [];
    if (selectedGenre === 'All') {
        Object.values(selectedService.genres).forEach(arr => movies.push(...arr));
    } else {
        movies = selectedService.genres[selectedGenre] || [];
    }

    movies.forEach(movie => {
        const li = document.createElement('li');
        li.className = 'movieItem';

        const icon = document.createElement('img');
        icon.src = isSelected(movie) ? '/images/selected.svg' : '/images/unselected.svg';
        icon.alt = isSelected(movie) ? 'Selected' : 'Not selected';

        icon.addEventListener('click', () => {
            toggleMovie(movie);
            renderMovies();
            renderOrder();
        });

        li.innerHTML =
            '<strong>' + movie.title + ' (' + movie.year + ')</strong>' +
            '<p>' + movie.description + '</p>' +
            '<p>$' + movie.price.toFixed(2) + '</p>';

        li.prepend(icon);
        moviesList.appendChild(li);
    });
}

function isSelected(movie) {
    return order[selectedService.name].some(m => m.id === movie.id);
}

function toggleMovie(movie) {
    if (isSelected(movie)) {
        order[selectedService.name] =
            order[selectedService.name].filter(m => m.id !== movie.id);
    } else {
        order[selectedService.name].push(movie);
    }
}

// renders the order summary with fees, totals, warnings and place order button
function renderOrder() {
    orderSummary.innerHTML = '';

    let allItems = [];
    for (const [svcName, movies] of Object.entries(order)) {
        movies.forEach(movie => allItems.push({ svcName, movie }));
    }

    let movieSubtotal = 0;

    allItems.forEach(item => {
        movieSubtotal += item.movie.price;

        const div = document.createElement('div');
        div.className = 'orderItem';

        const removeIcon = document.createElement('img');
        removeIcon.src = '/images/remove.svg';

        removeIcon.addEventListener('click', () => {
            if (confirm('Remove this movie?')) {
                order[item.svcName] =
                    order[item.svcName].filter(m => m.id !== item.movie.id);

                if (selectedService && selectedService.name === item.svcName) {
                    renderMovies();
                }
                renderOrder();
            }
        });

        div.innerHTML =
            item.movie.title + ' (' + item.movie.year + ') - $' + item.movie.price.toFixed(2);

        div.appendChild(removeIcon);
        orderSummary.appendChild(div);
    });

    let totalFees = 0;
    let feeParts  = [];

    for (const [svcName, movies] of Object.entries(order)) {
        if (movies.length > 0 && serviceFeeCache[svcName] !== undefined) {
            totalFees += serviceFeeCache[svcName];
            feeParts.push('$' + serviceFeeCache[svcName].toFixed(2));
        }
    }

    const feesText = feeParts.length > 0
        ? '(' + feeParts.join(' + ') + ') = $' + totalFees.toFixed(2)
        : '( ) = $0.00';

    const feesDiv = document.createElement('p');
    feesDiv.textContent = 'Service Fees: ' + feesText;
    orderSummary.appendChild(feesDiv);

    const subtotal = movieSubtotal + totalFees;
    const tax      = subtotal * 0.13;
    const total    = subtotal + tax;

    const subtotalP = document.createElement('p');
    subtotalP.textContent = 'Subtotal: $' + subtotal.toFixed(2);
    orderSummary.appendChild(subtotalP);

    const taxP = document.createElement('p');
    taxP.textContent = 'Tax (13%): $' + tax.toFixed(2);
    orderSummary.appendChild(taxP);

    const totalP = document.createElement('p');
    totalP.innerHTML = '<strong>Total: $' + total.toFixed(2) + '</strong>';
    orderSummary.appendChild(totalP);

    let canSubmit = allItems.length > 0;

    for (const [svcName, movies] of Object.entries(order)) {
        if (movies.length === 0) continue;
        const svcMovieTotal = movies.reduce((s, m) => s + m.price, 0);
        const minOrder      = serviceFeeCache[svcName + '_min'] || 0;

        if (svcMovieTotal > 0 && svcMovieTotal < minOrder) {
            const warning = document.createElement('p');
            warning.className   = 'warning';
            warning.textContent =
                svcName + ': Add $' +
                (minOrder - svcMovieTotal).toFixed(2) +
                ' more to meet minimum.';
            orderSummary.appendChild(warning);
            canSubmit = false;
        }
    }

    if (allItems.length > 0 && canSubmit) {
        const btn = document.createElement('button');
        btn.textContent = 'Place Order';

        btn.addEventListener('click', () => {
            submitOrder(subtotal, tax, total);
        });

        orderSummary.appendChild(btn);
    }
}

function submitOrder(subtotal, tax, total) {
    const fees   = {};
    const movies = {};

    for (const [svcName, movieList] of Object.entries(order)) {
        if (movieList.length === 0) continue;
        fees[svcName]   = serviceFeeCache[svcName] || 0;
        movies[svcName] = movieList;
    }

    const payload = { fees, subtotal, tax, total, movies };

    fetch('/submit-order', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(payload)
    })
        .then(res => {
            if (!res.ok) throw new Error('Server responded with ' + res.status);
            return res.json();
        })
        .then(() => {
            alert('Order submitted!');
            resetPage();
        })
        .catch(err => {
            console.error('Order submission failed:', err);
            alert('There was a problem placing your order. Please try again.');
        });
}

function resetPage() {
    for (const key of Object.keys(order)) {
        order[key] = [];
    }

    selectedService = null;
    selectedGenre   = 'All';

    serviceSelect.value        = '';
    serviceInfo.classList.add('hidden');
    genreBar.classList.add('hidden');
    mainContent.classList.add('hidden');

    genreBar.innerHTML         = '';
    moviesList.innerHTML       = '';
    moviesHeading.textContent  = 'Movies';
    serviceName.textContent    = '';
    serviceDetails.textContent = '';
    orderSummary.innerHTML     = '';
}