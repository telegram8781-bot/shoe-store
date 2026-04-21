// ════════════════════════════════════════════
//  ЛОГИКА ПРИЛОЖЕНИЯ
//  Зависит от: data.js (PRODUCTS, CATEGORIES)
// ════════════════════════════════════════════
(function () {
    'use strict';

    // ════════════════════════════════════════════
    //  КОНФИГ
    // ════════════════════════════════════════════
    const CFG = {
        PER_PAGE:    10,
        DEBOUNCE_MS: 280,
        STORAGE_KEY: 'shoe_cart_v3',
        ORDERS_KEY:  'shoe_orders_v1',   // история заказов
    };

    // ════════════════════════════════════════════
    //  СОСТОЯНИЕ
    // ════════════════════════════════════════════
    let state = {
        cart:              [],
        view:              'categories',
        currentCategory:   null,
        currentPage:       1,
        filteredProducts:  [],
        searchQuery:       '',
        quantityMap:       {},
        currentOrderData:  null,   // последний оформленный заказ (для кнопки копирования)
    };

    // Для удобства обращаемся к глобальным переменным из data.js
    const PRODUCTS = window.PRODUCTS;
    const CATEGORIES = window.CATEGORIES;

    // ════════════════════════════════════════════
    //  TELEGRAM
    // ════════════════════════════════════════════
    let tg = null;
    function initTelegram() {
        try {
            if (window.Telegram?.WebApp) {
                tg = window.Telegram.WebApp;
                tg.ready();
                tg.expand();
                tg.BackButton.onClick(handleBack);
                try { tg.setHeaderColor('#1a8fc7'); } catch (e) { console.warn('setHeaderColor error:', e); }
                try { tg.setBackgroundColor('#f0f4f8'); } catch (e) { console.warn('setBackgroundColor error:', e); }
            } else {
                // Показываем подсказку для обычного браузера
                const fb = $('web-fallback-notice');
                if (fb) fb.style.display = 'flex';
            }
        } catch (e) {
            console.warn('TG WebApp N/A', e);
        }
    }

    function updateTgBack() {
        if (!tg) return;
        (state.view !== 'categories') ? tg.BackButton.show() : tg.BackButton.hide();
    }

    function handleBack() {
        const modal = $('cart-modal');
        if (modal.classList.contains('active')) { closeModal(); return; }
        if (state.view === 'receipt')   { startNewOrder(); return; }
        if (state.view === 'order')     { showCartModal(); return; }
        if (state.view === 'products')  { goToCategories(); return; }
        if (state.view === 'history')   { goToCategories(); return; }
    }

    // ════════════════════════════════════════════
    //  CART — STORAGE
    // ════════════════════════════════════════════
    function saveCart() {
        try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(state.cart)); } catch (e) {
            console.warn('saveCart error:', e);
            toast('Корзина не сохранена: хранилище недоступно', 'error');
        }
    }
    function loadCart() {
        try {
            const raw = localStorage.getItem(CFG.STORAGE_KEY);
            if (raw) { state.cart = JSON.parse(raw); refreshCartUI(); }
        } catch (e) { console.warn('loadCart error:', e); }
    }

    // ════════════════════════════════════════════
    //  ORDERS — ИСТОРИЯ ЗАКАЗОВ
    // ════════════════════════════════════════════
    function saveOrder(order) {
        try {
            const orders = loadOrders();
            orders.unshift(order);                // новые — в начало
            if (orders.length > 50) orders.splice(50);  // максимум 50
            localStorage.setItem(CFG.ORDERS_KEY, JSON.stringify(orders));
        } catch (e) {
            console.warn('saveOrder error:', e);
            toast('История не сохранена: хранилище недоступно или переполнено', 'error');
        }
    }

    function loadOrders() {
        try {
            const raw = localStorage.getItem(CFG.ORDERS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { console.warn('loadOrders error:', e); return []; }
    }

    function updateHistoryLink() {
        const orders = loadOrders();
        const wrap  = $('history-link-wrap');
        const badge = $('history-link-count');
        if (orders.length > 0) {
            wrap.style.display = 'block';
            badge.textContent = orders.length;
        } else {
            wrap.style.display = 'none';
        }
    }

    // ════════════════════════════════════════════
    //  CART — OPERATIONS
    // ════════════════════════════════════════════
    /** Подсчёт общей суммы, количества упаковок, пар и позиций в корзине */
    function getCartSummary() {
        return state.cart.reduce((s, item) => ({
            total:      s.total + item.total_price,
            totalBoxes: s.totalBoxes + item.boxes,
            totalPairs: s.totalPairs + item.total_pairs,
            count:      s.count + 1,
        }), { total: 0, totalBoxes: 0, totalPairs: 0, count: 0 });
    }

    function addToCart(product, boxes) {
        if (boxes < 1) return;
        const existing = state.cart.find(i => i.article === product.article);
        if (existing) {
            const newBoxes = Math.min(existing.boxes + boxes, product.max_boxes);
            existing.boxes       = newBoxes;
            existing.total_pairs = newBoxes * product.box_size;
            existing.total_price = existing.total_pairs * product.price;
        } else {
            const totalPairs = boxes * product.box_size;
            state.cart.push({
                article:     product.article,
                name:        product.name,
                category:    CATEGORIES[state.currentCategory].name,
                price:       product.price,
                box_size:    product.box_size,
                max_boxes:   product.max_boxes,
                boxes,
                total_pairs: totalPairs,
                total_price: totalPairs * product.price,
            });
        }
        saveCart();
        refreshCartUI();
        refreshCategoryBadges();
        haptic('success');
        toast(`✓ ${product.article} — ${boxes} упак. добавлено`, 'success');
    }

    function removeFromCart(article) {
        const idx = state.cart.findIndex(i => i.article === article);
        if (idx === -1) return;
        const removed = state.cart.splice(idx, 1)[0];
        saveCart();
        refreshCartUI();
        refreshCategoryBadges();
        if (state.cart.length === 0) {
            closeModal();
        } else {
            showCartModal();
        }
        toast(`Удалено: ${removed.article}`, 'error');
    }

    function updateCartItemBoxes(article, delta) {
        const item = state.cart.find(i => i.article === article);
        if (!item) return;
        const newBoxes = Math.max(1, Math.min(item.max_boxes, item.boxes + delta));
        if (newBoxes === item.boxes) return;
        item.boxes       = newBoxes;
        item.total_pairs = newBoxes * item.box_size;
        item.total_price = item.total_pairs * item.price;
        saveCart();
        refreshCartUI();
        refreshCategoryBadges();
        showCartModal();
    }

    // ════════════════════════════════════════════
    //  CART — UI
    // ════════════════════════════════════════════
    function refreshCartUI() {
        const { total, count } = getCartSummary();
        $('cart-count').textContent    = `${count} ${decl(count, 'позиция', 'позиции', 'позиций')}`;
        $('cart-total').textContent    = fmtPrice(total);
        $('cart-badge').textContent    = count > 99 ? '99+' : count;
        $('modal-cart-total').textContent = fmtPrice(total);
        $('cart-bar').classList.toggle('visible', count > 0);
    }

    function refreshCategoryBadges() {
        document.querySelectorAll('.category-card').forEach(card => {
            const key       = card.dataset.key;
            const countInCat = state.cart.filter(i => PRODUCTS[key]?.find(p => p.article === i.article)).length;
            card.classList.toggle('has-items', countInCat > 0);
            const badge = card.querySelector('.cat-in-cart');
            if (badge) badge.textContent = countInCat > 0 ? `${countInCat} в корзине` : '';
        });
    }

    function showCartModal() {
        const items = $('cart-items');
        items.innerHTML = '';

        if (state.cart.length === 0) {
            items.innerHTML = `
                <div class="empty-state">
                    <div class="e-icon" aria-hidden="true">🛒</div>
                    <div class="e-text">В корзине нет товаров</div>
                </div>`;
            $('modal-checkout-btn').style.display = 'none';
        } else {
            $('modal-checkout-btn').style.display = 'flex';
            state.cart.forEach(item => items.appendChild(buildCartItem(item)));

            const { total, totalBoxes, totalPairs, count } = getCartSummary();
            const totRow = document.createElement('div');
            totRow.className = 'cart-total-row';
            totRow.innerHTML = `
                <div class="cart-total-label">
                    Итого · ${count} ${decl(count, 'позиция', 'позиции', 'позиций')}<br>
                    <span style="font-size:12px">${totalBoxes} упак. · ${totalPairs} пар</span>
                </div>
                <div class="cart-total-value">${fmtPrice(total)}</div>`;
            items.appendChild(totRow);
        }

        $('cart-modal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function buildCartItem(item) {
        const div  = el('div', 'cart-item');
        const info = el('div', 'cart-item-info');
        info.innerHTML = `
            <div class="cart-item-article">${esc(item.article)}</div>
            <div class="cart-item-name">${esc(item.name)}</div>
            <div class="cart-item-meta">
                <span aria-hidden="true">📦</span> ${item.boxes} упак. × ${item.box_size} пар = <strong>${item.total_pairs} пар</strong>
            </div>`;

        // Кнопки изменения количества прямо в корзине
        const qtyRow   = el('div', 'cart-item-qty-row');
        const minusBtn = el('button', 'cart-qty-btn');
        minusBtn.type  = 'button';
        minusBtn.textContent = '−';
        minusBtn.disabled = item.boxes <= 1;
        minusBtn.setAttribute('aria-label', 'Уменьшить');

        const qtyCount = el('span', 'cart-qty-count');
        qtyCount.textContent = item.boxes;

        const qtyLabel = el('span', 'cart-qty-label');
        qtyLabel.textContent = 'упак.';

        const plusBtn  = el('button', 'cart-qty-btn');
        plusBtn.type   = 'button';
        plusBtn.textContent = '+';
        plusBtn.disabled = item.boxes >= item.max_boxes;
        plusBtn.setAttribute('aria-label', 'Увеличить');

        minusBtn.addEventListener('click', () => updateCartItemBoxes(item.article, -1));
        plusBtn.addEventListener('click',  () => updateCartItemBoxes(item.article, +1));

        qtyRow.appendChild(minusBtn);
        qtyRow.appendChild(qtyCount);
        qtyRow.appendChild(qtyLabel);
        qtyRow.appendChild(plusBtn);
        info.appendChild(qtyRow);

        const right     = el('div', 'cart-item-right');
        const price     = el('div', 'cart-item-price');
        price.textContent = fmtPrice(item.total_price);

        const removeBtn = el('button', 'remove-btn');
        removeBtn.type  = 'button';
        removeBtn.textContent = 'Удалить';
        let confirm = false;
        removeBtn.addEventListener('click', function () {
            if (!confirm) {
                confirm = true;
                this.textContent = 'Точно?';
                this.classList.add('confirm');
                setTimeout(() => {
                    confirm = false;
                    if (!this.isConnected) return;
                    this.textContent = 'Удалить';
                    this.classList.remove('confirm');
                }, 2200);
            } else {
                removeFromCart(item.article);
            }
        });

        right.appendChild(price);
        right.appendChild(removeBtn);
        div.appendChild(info);
        div.appendChild(right);
        return div;
    }

    function closeModal() {
        $('cart-modal').classList.remove('active');
        document.body.style.overflow = '';
    }

    // ════════════════════════════════════════════
    //  НАВИГАЦИЯ
    // ════════════════════════════════════════════
    function navigate(view) {
        state.view = view;
        $('categories-section').classList.toggle('active', view === 'categories');
        $('products-section').classList.toggle('active',   view === 'products');
        $('order-section').classList.toggle('active',      view === 'order');
        $('receipt-section').classList.toggle('active',    view === 'receipt');
        $('history-section').classList.toggle('active',    view === 'history');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        updateTgBack();
    }

    function goToCategories() {
        state.currentCategory  = null;
        state.currentPage      = 1;
        state.filteredProducts = [];
        state.searchQuery      = '';
        state.quantityMap      = {};
        refreshCartUI();
        navigate('categories');
    }

    function goToProducts(key) {
        state.currentCategory  = key;
        state.currentPage      = 1;
        state.filteredProducts = [...(PRODUCTS[key] || [])];
        state.searchQuery      = '';
        state.quantityMap      = {};

        $('search-input').value = '';
        $('search-clear').classList.remove('visible');

        const cat = CATEGORIES[key];
        $('cat-label').textContent = `${cat.emoji} ${cat.name} ${cat.range}`;

        navigate('products');
        renderPage();
        haptic('selection');
    }

    function goToHistory() {
        renderHistory();
        navigate('history');
        haptic('selection');
    }

    // ════════════════════════════════════════════
    //  КАТЕГОРИИ
    // ════════════════════════════════════════════
    function renderCategories() {
        const grid = $('categories-grid');
        grid.innerHTML = '';
        for (const [key, cat] of Object.entries(CATEGORIES)) {
            const count = PRODUCTS[key]?.length || 0;
            const card  = el('div', 'category-card');
            card.dataset.key = key;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.innerHTML = `
                <span class="cat-in-cart"></span>
                <span class="emoji" aria-hidden="true">${cat.emoji}</span>
                <div class="cat-name">${cat.name}</div>
                <div class="cat-range">${cat.range}</div>
                <div class="cat-count">${count} моделей</div>`;
            card.addEventListener('click',   () => goToProducts(key));
            card.addEventListener('keydown', e  => { if (e.key === 'Enter' || e.key === ' ') goToProducts(key); });
            grid.appendChild(card);
        }
    }

    // ════════════════════════════════════════════
    //  ТОВАРЫ
    // ════════════════════════════════════════════
    function renderPage() {
        const list  = $('products-list');
        list.innerHTML = '';

        const total = state.filteredProducts.length;
        const pages = Math.max(1, Math.ceil(total / CFG.PER_PAGE));
        state.currentPage = Math.min(Math.max(state.currentPage, 1), pages);

        const start = (state.currentPage - 1) * CFG.PER_PAGE;
        const items = state.filteredProducts.slice(start, start + CFG.PER_PAGE);

        $('items-count').textContent = state.searchQuery
            ? `Найдено: ${total}`
            : `${start + 1}–${start + items.length} из ${total}`;

        if (items.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="e-icon" aria-hidden="true">🔍</div>
                    <div class="e-text">${state.searchQuery ? 'Ничего не найдено' : 'Нет товаров'}</div>
                </div>`;
            renderPagination(0);
            return;
        }

        items.forEach(p => list.appendChild(buildCard(p)));
        renderPagination(pages);
    }

    function buildCard(p) {
        const card = el('div', 'product-card');

        // Изображение
        const imgWrap = el('div', 'product-image-wrap');
        const img     = el('img', 'product-image');
        img.alt     = p.name;
        img.loading = 'lazy';
        if (p.image) {
            img.src = p.image;
            img.addEventListener('load',  () => img.classList.add('loaded'));
            img.addEventListener('error', () => img.style.display = 'none');
        }
        const placeholder = el('div', 'product-image-placeholder');
        placeholder.textContent = CATEGORIES[state.currentCategory]?.emoji || '👟';
        placeholder.setAttribute('aria-hidden', 'true');
        imgWrap.appendChild(img);
        imgWrap.appendChild(placeholder);

        // Информация о товаре
        const info    = el('div', 'product-info');
        const article = el('div', 'product-article');
        article.textContent = p.article;

        const name = el('div', 'product-name');
        name.textContent = p.name;

        const priceRow  = el('div', 'product-price-row');
        const priceEl   = el('span', 'product-price');
        priceEl.textContent = fmtPrice(p.price);
        const priceUnit = el('span', 'product-price-unit');
        priceUnit.textContent = '/ пара';
        priceRow.appendChild(priceEl);
        priceRow.appendChild(priceUnit);

        const tags = el('div', 'product-tags');
        tags.innerHTML = `
            <span class="product-tag"><span aria-hidden="true">📦</span> ${p.box_size} пар/упак.</span>
            <span class="product-tag">Макс. ${p.max_boxes} упак.</span>
            <span class="product-tag">Упак: ${fmtPrice(p.price * p.box_size)}</span>`;

        // Выбор количества
        const qtyRow   = el('div', 'qty-row');
        const minusBtn = el('button', 'qty-btn');
        minusBtn.type = 'button';
        minusBtn.textContent = '−';
        minusBtn.setAttribute('aria-label', 'Уменьшить');

        const qtyCenter = el('div', 'qty-center');
        const qtyVal    = el('div', 'qty-value');
        const qtySub    = el('div', 'qty-sublabel');
        qtySub.textContent = 'упак.';

        const currentQty = state.quantityMap[p.article] || 0;
        qtyVal.textContent  = currentQty;
        minusBtn.disabled   = currentQty === 0;

        const plusBtn = el('button', 'qty-btn');
        plusBtn.type  = 'button';
        plusBtn.textContent = '+';
        plusBtn.disabled = currentQty >= p.max_boxes;
        plusBtn.setAttribute('aria-label', 'Увеличить');

        qtyCenter.appendChild(qtyVal);
        qtyCenter.appendChild(qtySub);

        // Предварительный расчёт стоимости
        const preview = el('div', 'qty-preview hidden');

        function updateQty(delta) {
            let q = parseInt(qtyVal.textContent) || 0;
            q = Math.max(0, Math.min(p.max_boxes, q + delta));
            qtyVal.textContent = q;
            state.quantityMap[p.article] = q;
            minusBtn.disabled = q === 0;
            plusBtn.disabled  = q >= p.max_boxes;

            if (q > 0) {
                const pairs = q * p.box_size;
                preview.textContent = `${q} упак. = ${pairs} пар · ${fmtPrice(pairs * p.price)}`;
                preview.classList.remove('hidden');
            } else {
                preview.textContent = '';
                preview.classList.add('hidden');
            }
        }

        if (currentQty > 0) {
            const pairs = currentQty * p.box_size;
            preview.textContent = `${currentQty} упак. = ${pairs} пар · ${fmtPrice(pairs * p.price)}`;
            preview.classList.remove('hidden');
        }

        minusBtn.addEventListener('click', () => updateQty(-1));
        plusBtn.addEventListener('click',  () => updateQty(+1));

        qtyRow.appendChild(minusBtn);
        qtyRow.appendChild(qtyCenter);
        qtyRow.appendChild(plusBtn);

        // Кнопка добавления в корзину
        const addBtn = el('button', 'add-btn');
        addBtn.type  = 'button';
        addBtn.innerHTML = '<span aria-hidden="true">🛒</span> Добавить в корзину';
        addBtn.addEventListener('click', () => {
            let qty = parseInt(qtyVal.textContent) || 0;
            if (qty === 0) qty = 1;
            addToCart(p, qty);

            addBtn.innerHTML = '✓ Добавлено!';
            addBtn.classList.add('added');
            qtyVal.textContent = 0;
            state.quantityMap[p.article] = 0;
            minusBtn.disabled = true;
            plusBtn.disabled  = false;
            preview.textContent = '';
            preview.classList.add('hidden');

            setTimeout(() => {
                addBtn.innerHTML = '<span aria-hidden="true">🛒</span> Добавить в корзину';
                addBtn.classList.remove('added');
            }, 1800);
        });

        info.appendChild(article);
        info.appendChild(name);
        info.appendChild(priceRow);
        info.appendChild(tags);
        info.appendChild(qtyRow);
        info.appendChild(preview);
        info.appendChild(addBtn);

        card.appendChild(imgWrap);
        card.appendChild(info);
        return card;
    }

    // ════════════════════════════════════════════
    //  ПАГИНАЦИЯ
    // ════════════════════════════════════════════
    function renderPagination(totalPages) {
        const cont = $('pagination');
        cont.innerHTML = '';
        if (totalPages <= 1) return;

        function mkBtn(label, page, disabled) {
            const b = el('button', 'page-btn' + (page === state.currentPage ? ' active' : ''));
            b.type    = 'button';
            b.innerHTML = label;
            b.disabled  = disabled;
            b.addEventListener('click', () => {
                state.currentPage = page;
                renderPage();
                $('products-section').scrollIntoView({ behavior: 'smooth' });
            });
            return b;
        }

        cont.appendChild(mkBtn('←', state.currentPage - 1, state.currentPage === 1));
        let s = Math.max(1, state.currentPage - 2);
        let e = Math.min(totalPages, s + 4);
        if (e - s < 4) s = Math.max(1, e - 4);
        for (let i = s; i <= e; i++) cont.appendChild(mkBtn(i, i, false));
        cont.appendChild(mkBtn('→', state.currentPage + 1, state.currentPage === totalPages));
    }

    // ════════════════════════════════════════════
    //  ПОИСК
    // ════════════════════════════════════════════
    function doSearch() {
        const q = $('search-input').value.toUpperCase().trim();
        state.searchQuery = q;
        const base = PRODUCTS[state.currentCategory] || [];
        state.filteredProducts = q
            ? base.filter(p => p.article.toUpperCase().includes(q) || p.name.toUpperCase().includes(q))
            : [...base];
        state.currentPage = 1;
        renderPage();
    }

    // ════════════════════════════════════════════
    //  ОФОРМЛЕНИЕ
    // ════════════════════════════════════════════
    function showOrderForm() {
        closeModal();
        const { total, totalBoxes, totalPairs, count } = getCartSummary();

        const summary = $('order-summary');
        summary.innerHTML = '';
        const title = el('div', 'summary-title');
        title.textContent = 'Итого по заказу';
        summary.appendChild(title);

        [
            ['Позиций',   count],
            ['Упаковок',  totalBoxes + ' шт.'],
            ['Пар обуви', totalPairs + ' шт.'],
        ].forEach(([label, val]) => {
            const row = el('div', 'summary-row');
            row.innerHTML = `<span>${label}</span><span>${val}</span>`;
            summary.appendChild(row);
        });

        const totDiv = el('div', 'summary-total');
        totDiv.innerHTML = `<span class="summary-total-label">К оплате</span><span class="summary-total-value">${fmtPrice(total)}</span>`;
        summary.appendChild(totDiv);

        navigate('order');
    }

    // ── URL вашего задеплоенного Google Apps Script ──────────
    // После публикации скрипта вставьте сюда полученный Web App URL
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbxyqG98dj_vLJNSXRTrMT97WCjUpUwISNaxwyFUFnYts8f_ZQ7KU9SLLjhFH-ZcZTEV/exec';

    function submitOrder() {
        if (state.cart.length === 0) {
            toast('В корзине нет товаров', 'error');
            return;
        }

        const phoneEl = $('phone');
        const phone   = phoneEl.value.trim();
        const digits  = phone.replace(/\D/g, '');
        const isValidPhone = digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'));

        if (!isValidPhone) {
            phoneEl.classList.add('error');
            $('phone-error').classList.add('visible');
            phoneEl.focus();
            toast('Укажите корректный номер телефона', 'error');
            return;
        }
        phoneEl.classList.remove('error');
        $('phone-error').classList.remove('visible');

        // Блокируем кнопку для предотвращения двойной отправки
        const btn = $('submit-order-btn');
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Отправляем…';

        const comment    = $('comment').value.trim();
        const { totalBoxes, totalPairs } = getCartSummary();

        // Формируем payload — передаём только артикул, кол-во упак. и размер упак.
        // Цену НЕ передаём: сервер возьмёт её из прайса сам
        const payload = {
            phone,
            comment,
            items: state.cart.map(item => ({
                article:  item.article,
                name:     item.name,
                boxes:    item.boxes,
                box_size: item.box_size,
                // total_price намеренно не передаётся — сервер пересчитает
            })),
            totalBoxes,
            totalPairs,
            user_id:    tg?.initDataUnsafe?.user?.id       ?? 'web',
            username:   tg?.initDataUnsafe?.user?.username ?? '',
            ordered_at: new Date().toISOString(),
        };

        fetch(GAS_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'text/plain' },
            body:    JSON.stringify(payload),
        })
        .then(res => {
            // Google Apps Script всегда возвращает 200; читаем JSON
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(data => {
            if (!data.ok) throw new Error(data.error || 'Ошибка сервера');

            // Сервер вернул пересчитанную сумму — используем её для чека
            const orderData = {
                phone, comment,
                items:       state.cart,
                total:       data.total,       // ← реальная сумма из прайса
                totalBoxes,
                totalPairs,
                orderNum:    data.orderNum,
                user_id:     payload.user_id,
                username:    payload.username,
                ordered_at:  payload.ordered_at,
            };

            showReceipt(orderData);
        })
        .catch(err => {
            console.error('submitOrder error:', err);
            btn.disabled = false;
            btn.innerHTML = '<span>✓</span> Отправить заказ';
            toast('Ошибка отправки: ' + err.message, 'error');
        });
    }

    function showReceipt(orderData) {
        // Номер заказа уже содержится в orderData (прислан сервером)
        // Если по какой-то причине его нет — генерируем локальный fallback
        if (!orderData.orderNum) {
            orderData.orderNum = 'ORD-' + Date.now().toString(36).toUpperCase().slice(-6);
        }
        const orderNum = orderData.orderNum;

        $('receipt-order-num').textContent = `Номер заказа: ${orderNum}`;

        const box = $('receipt-content');
        box.innerHTML = '';

        // Контактные данные
        const contactSection = el('div');
        const contactTitle   = el('div', 'receipt-section-title');
        contactTitle.textContent = 'Контактные данные';
        contactSection.appendChild(contactTitle);

        [
            { icon: '<span aria-hidden="true">📞</span>', label: orderData.phone },
            orderData.comment ? { icon: '<span aria-hidden="true">📝</span>', label: orderData.comment } : null,
        ]
            .filter(Boolean)
            .forEach(({ icon, label }) => {
                const row = el('div', 'receipt-contact-row');
                row.innerHTML = `<span>${icon}</span><span>${esc(label)}</span>`;
                contactSection.appendChild(row);
            });
        box.appendChild(contactSection);

        // Состав заказа
        const itemsSection = el('div');
        itemsSection.style.marginTop = '16px';
        const itemsTitle = el('div', 'receipt-section-title');
        itemsTitle.textContent = 'Состав заказа';
        itemsSection.appendChild(itemsTitle);

        state.cart.forEach(item => {
            const row = el('div', 'receipt-item');
            row.innerHTML = `
                <div class="receipt-item-left">
                    <div class="receipt-item-article">${esc(item.article)}</div>
                    <div class="receipt-item-name">${esc(item.name)}</div>
                    <div class="receipt-item-qty">${item.boxes} упак. × ${item.box_size} пар = ${item.total_pairs} пар</div>
                </div>
                <div class="receipt-item-price">${fmtPrice(item.total_price)}</div>`;
            itemsSection.appendChild(row);
        });

        const grandTotal = el('div', 'receipt-grand-total');
        grandTotal.innerHTML = `<span class="receipt-grand-label">ИТОГО</span><span class="receipt-grand-value">${fmtPrice(orderData.total)}</span>`;
        itemsSection.appendChild(grandTotal);
        box.appendChild(itemsSection);

        // Сохраняем в историю
        saveOrder(JSON.parse(JSON.stringify(orderData))); // deep copy
        updateHistoryLink();

        // Запоминаем для кнопки копирования
        state.currentOrderData = orderData;

        // Сбрасываем кнопку копирования в исходное состояние
        const copyBtn = $('copy-receipt-btn');
        copyBtn.innerHTML = '📋 Скопировать чек';
        copyBtn.classList.remove('copied');

        navigate('receipt');
        haptic('success');
    }

    function startNewOrder() {
        state.cart             = [];
        state.quantityMap      = {};
        state.currentOrderData = null;
        saveCart();
        $('phone').value = '';
        $('phone').classList.remove('error');
        $('phone-error').classList.remove('visible');
        $('comment').value = '';
        const btn = $('submit-order-btn');
        btn.disabled  = false;
        btn.innerHTML = '<span>✓</span> Отправить заказ';
        closeModal();
        refreshCartUI();
        goToCategories();
        toast('Новый заказ — начали! 🚀', 'info');
    }

    // ════════════════════════════════════════════
    //  ИСТОРИЯ ЗАКАЗОВ
    // ════════════════════════════════════════════
    function renderHistory() {
        const list   = $('history-list');
        const orders = loadOrders();
        list.innerHTML = '';

        if (orders.length === 0) {
            list.innerHTML = `
                <div class="history-empty">
                    <span class="e-icon" aria-hidden="true">📋</span>
                    <div class="e-text">Заказов пока нет</div>
                </div>`;
            return;
        }

        orders.forEach((order, i) => list.appendChild(buildOrderCard(order, i)));
    }

    function buildOrderCard(order, index) {
        const card = el('div', 'order-card');

        // Форматируем дату
        const d   = new Date(order.ordered_at);
        const day = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        const tim = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        // Шапка карточки
        const header = el('div', 'order-card-header');
        header.innerHTML = `
            <div class="order-card-top">
                <div class="order-card-num">#${esc(order.orderNum || '—')}</div>
                <div class="order-card-total">${fmtPrice(order.total)}</div>
            </div>
            <div class="order-card-date"><span aria-hidden="true">📅</span> ${day}, ${tim}</div>
            <div class="order-card-tags">
                <span class="order-meta-tag"><span aria-hidden="true">📦</span> ${order.totalBoxes} упак.</span>
                <span class="order-meta-tag"><span aria-hidden="true">👟</span> ${order.totalPairs} пар</span>
                <span class="order-meta-tag">${order.items.length} ${decl(order.items.length, 'позиция', 'позиции', 'позиций')}</span>
            </div>`;

        // Кнопка «Детали заказа»
        const expandBtn = el('button', 'order-card-expand');
        expandBtn.type  = 'button';
        expandBtn.innerHTML = `<span>Детали заказа</span><span class="expand-arrow">▼</span>`;
        expandBtn.addEventListener('click', () => card.classList.toggle('expanded'));

        // Тело карточки (скрытое)
        const body = el('div', 'order-card-body');

        // Список товаров
        order.items.forEach(item => {
            const row = el('div', 'order-body-item');
            row.innerHTML = `
                <div class="order-body-left">
                    <div class="order-body-article">${esc(item.article)}</div>
                    <div class="order-body-name">${esc(item.name)}</div>
                    <div class="order-body-qty">${item.boxes} упак. × ${item.box_size} пар = ${item.total_pairs} пар</div>
                </div>
                <div class="order-body-price">${fmtPrice(item.total_price)}</div>`;
            body.appendChild(row);
        });

        // Контакт
        if (order.phone) {
            const phoneRow = el('div', 'order-body-phone');
            phoneRow.innerHTML = `<span><span aria-hidden="true">📞</span> ${esc(order.phone)}</span>${order.comment ? `<span><span aria-hidden="true">📝</span> ${esc(order.comment)}</span>` : ''}`;
            body.appendChild(phoneRow);
        }

        // Кнопка копирования чека
        const copyBtn = el('button', 'copy-receipt-btn');
        copyBtn.type  = 'button';
        copyBtn.innerHTML = '📋 Скопировать чек';
        copyBtn.addEventListener('click', () => copyToClipboard(formatReceiptText(order), copyBtn));
        body.appendChild(copyBtn);

        card.appendChild(header);
        card.appendChild(expandBtn);
        card.appendChild(body);

        // Первую (самую свежую) карточку открываем сразу
        if (index === 0) card.classList.add('expanded');

        return card;
    }

    // ════════════════════════════════════════════
    //  ФОРМАТИРОВАНИЕ ТЕКСТОВОГО ЧЕКА
    // ════════════════════════════════════════════
    function formatReceiptText(order) {
        const ts    = order.ordered_at ? new Date(order.ordered_at) : new Date();
        const day   = ts.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        const tim   = ts.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const line  = '━━━━━━━━━━━━━━━━━━━━━━';

        let text = '';
        text += `📦 Заказ #${order.orderNum || '—'}\n`;
        text += `📅 ${day}, ${tim}\n`;
        text += `Оптовый магазин обуви\n\n`;
        text += `${line}\n`;
        text += `СОСТАВ ЗАКАЗА\n`;
        text += `${line}\n\n`;

        (order.items || []).forEach((item, i) => {
            text += `${i + 1}. ${item.article || '—'} — ${item.name || '—'}\n`;
            text += `   ${item.boxes || 0} упак. × ${item.box_size || 0} пар = ${item.total_pairs || 0} пар\n`;
            text += `   ${Number(item.price || 0).toLocaleString('ru-RU')} ₽/пара → ${Number(item.total_price || 0).toLocaleString('ru-RU')} ₽\n\n`;
        });

        text += `${line}\n`;
        text += `📦 Упаковок:  ${order.totalBoxes || 0} шт.\n`;
        text += `👟 Пар:       ${order.totalPairs || 0} шт.\n`;
        text += `💰 ИТОГО:     ${Number(order.total || 0).toLocaleString('ru-RU')} ₽\n`;
        text += `${line}\n\n`;
        text += `📞 ${order.phone || '—'}`;
        if (order.comment) text += `\n📝 ${order.comment}`;

        return text;
    }

    // ════════════════════════════════════════════
    //  КОПИРОВАНИЕ В БУФЕР ОБМЕНА
    // ════════════════════════════════════════════
    /** Копирует текст в буфер обмена с fallback для старых браузеров */
    function copyToClipboard(text, btn) {
        const originalHTML = btn.innerHTML;

        const onSuccess = () => {
            btn.innerHTML = '✓ Скопировано!';
            btn.classList.add('copied');
            haptic('success');
            toast('Чек скопирован — можно отправить менеджеру 👍', 'success');
            setTimeout(() => {
                if (!btn.isConnected) return;
                btn.innerHTML = originalHTML;
                btn.classList.remove('copied');
            }, 3000);
        };

        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess));
        } else {
            fallbackCopy(text, onSuccess);
        }
    }

    // Fallback для Telegram WebView и старых браузеров
    function fallbackCopy(text, onSuccess) {
        const ta = document.createElement('textarea');
        ta.value         = text;
        ta.style.cssText = 'position:fixed;top:-200px;left:-200px;opacity:0;font-size:16px;';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
            const ok = document.execCommand('copy');
            if (ok) {
                onSuccess();
            } else {
                toast('Не удалось скопировать автоматически', 'error');
            }
        } catch (e) {
            console.warn('fallbackCopy error:', e);
            toast('Не удалось скопировать автоматически', 'error');
        }
        document.body.removeChild(ta);
    }

    // ════════════════════════════════════════════
    //  ТЕЛЕФОН — ФОРМАТИРОВАНИЕ
    // ════════════════════════════════════════════
    /** Форматирование ввода телефона: приводит к виду +7 (XXX) XXX-XX-XX */
    function formatPhone(e) {
        let raw = e.target.value.replace(/\D/g, '');
        if (raw.startsWith('8')) raw = '7' + raw.slice(1);
        if (raw.startsWith('7')) raw = raw.slice(1);

        let out = '+7';
        if (raw.length > 0) out += ' (' + raw.slice(0, 3);
        if (raw.length >= 3) out += ') ' + raw.slice(3, 6);
        if (raw.length >= 6) out += '-' + raw.slice(6, 8);
        if (raw.length >= 8) out += '-' + raw.slice(8, 10);
        e.target.value = out;
    }

    // ════════════════════════════════════════════
    //  TOAST
    // ════════════════════════════════════════════
    let _toastTimer;
    function toast(msg, type) {
        const t = $('toast');
        t.textContent = msg;
        t.className   = 'toast visible' + (type ? ' ' + type : '');
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => t.classList.remove('visible'), 3200);
    }

    // ════════════════════════════════════════════
    //  УТИЛИТЫ
    // ════════════════════════════════════════════
    /** Получить элемент по ID */
    function $(id) { return document.getElementById(id); }
    /** Создать DOM-элемент с заданным классом */
    function el(tag, cls) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        return e;
    }
    /** Экранирование строки для безопасного вывода в HTML (защита от XSS) */
    function esc(s) {
        const d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }
    /** Форматирование цены в рубли */
    function fmtPrice(n) { return Number(n).toLocaleString('ru-RU') + ' ₽'; }
    /** Склонение слов (1, 2-4, 5+) */
    function decl(n, one, two, five) {
        const m = n % 10, c = n % 100;
        if (m === 1 && c !== 11) return one;
        if ([2,3,4].includes(m) && ![12,13,14].includes(c)) return two;
        return five;
    }
    /** Дебаунс для оптимизации частых вызовов (поиск) */
    function debounce(fn, ms) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    }
    /** Виброотклик через Telegram HapticFeedback */
    function haptic(type) {
        try {
            if (!tg?.HapticFeedback) return;
            if (type === 'selection') tg.HapticFeedback.selectionChanged();
            else tg.HapticFeedback.notificationOccurred(type);
        } catch (e) { console.warn('haptic error:', e); }
    }

    // ════════════════════════════════════════════
    //  СОБЫТИЯ
    // ════════════════════════════════════════════
    function bindEvents() {
        $('products-back-btn').addEventListener('click', goToCategories);
        $('order-back-btn').addEventListener('click', showCartModal);
        $('checkout-btn').addEventListener('click', showCartModal);
        $('close-cart-btn').addEventListener('click', closeModal);
        $('modal-checkout-btn').addEventListener('click', showOrderForm);
        $('submit-order-btn').addEventListener('click', submitOrder);
        $('new-order-btn').addEventListener('click', startNewOrder);
        $('history-link-btn').addEventListener('click', goToHistory);
        $('history-back-btn').addEventListener('click', goToCategories);

        // Кнопка копирования на экране чека
        $('copy-receipt-btn').addEventListener('click', () => {
            if (!state.currentOrderData) return;
            copyToClipboard(formatReceiptText(state.currentOrderData), $('copy-receipt-btn'));
        });

        // Поиск
        const si = $('search-input');
        const sc = $('search-clear');
        const dSearch = debounce(doSearch, CFG.DEBOUNCE_MS);
        si.addEventListener('input', function () {
            sc.classList.toggle('visible', this.value.length > 0);
            dSearch();
        });
        sc.addEventListener('click', () => {
            si.value = '';
            sc.classList.remove('visible');
            doSearch();
            si.focus();
        });

        // Закрытие модалки по фону
        $('cart-modal').addEventListener('click', e => {
            if (e.target === $('cart-modal')) closeModal();
        });

        // Телефон
        const phoneEl = $('phone');
        phoneEl.addEventListener('input', formatPhone);
        phoneEl.addEventListener('focus', () => {
            phoneEl.classList.remove('error');
            $('phone-error').classList.remove('visible');
        });
    }

    // ════════════════════════════════════════════
    //  INIT
    // ════════════════════════════════════════════
    function init() {
        initTelegram();
        renderCategories();
        loadCart();
        bindEvents();
        navigate('categories');
        updateHistoryLink();
    }

    // Запускаем только после загрузки дерева DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
