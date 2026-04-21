// ════════════════════════════════════════════
//  ДАННЫЕ — категории и товары (Ручной режим)
//  Редактируйте этот файл для управления каталогом
// ════════════════════════════════════════════

// ── Описания категорий ───────────────
window.CATEGORIES = {
    '26-31': { name: 'Ботинки',   range: '26–31 см', emoji: '👢' },
    '31-36': { name: 'Кроссовки', range: '31–36 см', emoji: '👟' },
    '32-37': { name: 'Кроссовки', range: '32–37 см', emoji: '👟' },
    '10-16': { name: 'Детская',   range: '10–16 см', emoji: '🧸' },
    '20-26': { name: 'Детская',   range: '20–26 см', emoji: '🧸' },
    '21-27': { name: 'Детская',   range: '21–27 см', emoji: '🧸' },
};

// ── Товары по ключу категории ──────────────────────────────────────
window.PRODUCTS = {
    
    // Категория: Ботинки 26-31 см
    '26-31': [
        {
            article: 'aktilek_kotok',
            name: 'aktilek_kotok',
            price: 1,
            box_size: 6,
            max_boxes: 10,
            image: 'https://www.punkypins.co.uk/cdn/shop/products/punky-pins-you-can-keep-those-dick-pics-vinyl-sticker-31562971709629.jpg?v=1646405910'
        },
        {
            article: 'DRM-2631-02',
            name: 'Dr. Martens 1460 Smooth Leather',
            price: 4800,
            box_size: 8,
            max_boxes: 12,
            image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=300&fit=crop'
        },
        // Добавьте сюда остальные 15+ товаров для этой категории
    ],

    // Категория: Кроссовки 31-36 см
    '31-36': [
        {
            article: 'NK-3136-AM90',
            name: 'Nike Air Max 90 Essential',
            price: 3500,
            box_size: 8,
            max_boxes: 20,
            image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=300&fit=crop'
        },
        {
            article: 'AD-3136-UB21',
            name: 'Adidas Ultraboost 21',
            price: 4100,
            box_size: 6,
            max_boxes: 15,
            image: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400&h=300&fit=crop'
        },
        {
            article: 'NB-3136-574',
            name: 'New Balance 574 Core',
            price: 3100,
            box_size: 10,
            max_boxes: 10,
            image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=300&fit=crop'
        },
        // Добавьте сюда остальные 15+ товаров для этой категории
    ],

    // Категория: Кроссовки 32-37 см
    '32-37': [
        {
            article: 'PM-3237-RSX',
            name: 'Puma RS-X3 Puzzle',
            price: 2900,
            box_size: 8,
            max_boxes: 15,
            image: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400&h=300&fit=crop'
        },
        {
            article: 'AS-3237-GL3',
            name: 'Asics Gel-Lyte III',
            price: 3300,
            box_size: 6,
            max_boxes: 20,
            image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=300&fit=crop'
        },
        // Добавьте сюда остальные 15+ товаров для этой категории
    ],

    // Категория: Детская 10-16 см
    '10-16': [
        {
            article: 'KID-NK-1016',
            name: 'Nike Force 1 Crib Baby',
            price: 1500,
            box_size: 12,
            max_boxes: 20,
            image: 'https://images.unsplash.com/photo-1514989940723-e4ca3e0d1e3e?w=400&h=300&fit=crop'
        },
        {
            article: 'KID-AD-1016',
            name: 'Adidas Superstar Crib',
            price: 1400,
            box_size: 10,
            max_boxes: 25,
            image: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=400&h=300&fit=crop'
        },
        // Добавьте сюда остальные 15+ товаров для этой категории
    ],

    // Категория: Детская 20-26 см
    '20-26': [
        {
            article: 'KID-RB-2026',
            name: 'Reebok Classic Leather Kids',
            price: 1800,
            box_size: 8,
            max_boxes: 15,
            image: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=400&h=300&fit=crop'
        },
        {
            article: 'KID-VN-2026',
            name: 'Vans Old Skool Velcro Kids',
            price: 1900,
            box_size: 10,
            max_boxes: 20,
            image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400&h=300&fit=crop'
        },
        // Добавьте сюда остальные 15+ товаров для этой категории
    ],

    // Категория: Детская 21-27 см
    '21-27': [
        {
            article: 'KID-CV-2127',
            name: 'Converse Chuck Taylor All Star Kids',
            price: 1700,
            box_size: 12,
            max_boxes: 10,
            image: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=400&h=300&fit=crop'
        },
        {
            article: 'KID-CR-2127',
            name: 'Crocs Classic Clog Kids',
            price: 1200,
            box_size: 15,
            max_boxes: 30,
            image: 'https://images.unsplash.com/photo-1514989940723-e4ca3e0d1e3e?w=400&h=300&fit=crop'
        },
        // Добавьте сюда остальные 15+ товаров для этой категории
    ]

};