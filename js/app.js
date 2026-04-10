/* ============================================
   FreshFit405 Grab & Go — App
   ============================================ */

// --- Configuration ---
const CONFIG = {
  shopifyDomain: 'freshfit405.myshopify.com',
  storefrontToken: '0c45a57ee24824b0929db72dd1d36af5',
  collectionId: 'gid://shopify/Collection/493844496691',
  apiVersion: '2025-01',
  get apiUrl() {
    return `https://${this.shopifyDomain}/api/${this.apiVersion}/graphql.json`;
  },
};

// --- State ---
const state = {
  products: [],
  cart: { id: null, lines: [], subtotal: '0.00', checkoutUrl: '' },
  loading: true,
  error: null,
  cartOpen: false,
};

// --- DOM References ---
const $ = (sel) => document.querySelector(sel);
const dom = {};

function cacheDom() {
  dom.skeletonGrid = $('#skeleton-grid');
  dom.productGrid = $('#product-grid');
  dom.errorState = $('#error-state');
  dom.errorMessage = $('#error-message');
  dom.retryBtn = $('#retry-btn');
  dom.cartToggle = $('#cart-toggle');
  dom.cartBadge = $('#cart-badge');
  dom.cartDrawer = $('#cart-drawer');
  dom.cartClose = $('#cart-close');
  dom.cartItems = $('#cart-items');
  dom.cartEmpty = $('#cart-empty');
  dom.cartFooter = $('#cart-footer');
  dom.cartSubtotal = $('#cart-subtotal');
  dom.checkoutBtn = $('#checkout-btn');
  dom.overlay = $('#overlay');
  dom.toastContainer = $('#toast-container');
  dom.header = $('header');
  dom.modalOverlay = $('#modal-overlay');
  dom.productModal = $('#product-modal');
  dom.modalClose = $('#modal-close');
  dom.modalGallery = $('#modal-gallery');
  dom.modalInfo = $('#modal-info');
}

// ============================================
// SHOPIFY STOREFRONT API
// ============================================

async function shopifyFetch(query, variables = {}) {
  const res = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': CONFIG.storefrontToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status}`);
  }

  const json = await res.json();

  if (json.errors) {
    throw new Error(json.errors.map((e) => e.message).join(', '));
  }

  return json.data;
}

async function fetchCollectionProducts() {
  const query = `
    query CollectionProducts($id: ID!) {
      collection(id: $id) {
        title
        products(first: 50) {
          edges {
            node {
              id
              title
              description
              descriptionHtml
              images(first: 5) {
                edges {
                  node {
                    url
                    altText
                    width
                    height
                  }
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    availableForSale
                    image {
                      url
                      altText
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyFetch(query, { id: CONFIG.collectionId });
  return data.collection.products.edges.map((e) => e.node);
}

async function createCart(variantId, quantity) {
  const query = `
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
          lines(first: 50) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    image {
                      url
                      altText
                    }
                    product {
                      title
                    }
                  }
                }
              }
            }
          }
          cost {
            subtotalAmount {
              amount
              currencyCode
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    input: {
      lines: [{ merchandiseId: variantId, quantity }],
    },
  };

  const data = await shopifyFetch(query, variables);

  if (data.cartCreate.userErrors.length > 0) {
    throw new Error(data.cartCreate.userErrors[0].message);
  }

  return data.cartCreate.cart;
}

async function addToCart(cartId, variantId, quantity) {
  const query = `
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          id
          checkoutUrl
          lines(first: 50) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    image {
                      url
                      altText
                    }
                    product {
                      title
                    }
                  }
                }
              }
            }
          }
          cost {
            subtotalAmount {
              amount
              currencyCode
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const data = await shopifyFetch(query, {
    cartId,
    lines: [{ merchandiseId: variantId, quantity }],
  });

  if (data.cartLinesAdd.userErrors.length > 0) {
    throw new Error(data.cartLinesAdd.userErrors[0].message);
  }

  return data.cartLinesAdd.cart;
}

async function updateCartLine(cartId, lineId, quantity) {
  const query = `
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          id
          checkoutUrl
          lines(first: 50) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    image {
                      url
                      altText
                    }
                    product {
                      title
                    }
                  }
                }
              }
            }
          }
          cost {
            subtotalAmount {
              amount
              currencyCode
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const data = await shopifyFetch(query, {
    cartId,
    lines: [{ id: lineId, quantity }],
  });

  if (data.cartLinesUpdate.userErrors.length > 0) {
    throw new Error(data.cartLinesUpdate.userErrors[0].message);
  }

  return data.cartLinesUpdate.cart;
}

async function removeCartLine(cartId, lineId) {
  const query = `
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          id
          checkoutUrl
          lines(first: 50) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    image {
                      url
                      altText
                    }
                    product {
                      title
                    }
                  }
                }
              }
            }
          }
          cost {
            subtotalAmount {
              amount
              currencyCode
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const data = await shopifyFetch(query, {
    cartId,
    lineIds: [lineId],
  });

  if (data.cartLinesRemove.userErrors.length > 0) {
    throw new Error(data.cartLinesRemove.userErrors[0].message);
  }

  return data.cartLinesRemove.cart;
}

async function fetchCart(cartId) {
  const query = `
    query Cart($cartId: ID!) {
      cart(id: $cartId) {
        id
        checkoutUrl
        lines(first: 50) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  image {
                    url
                    altText
                  }
                  product {
                    title
                  }
                }
              }
            }
          }
        }
        cost {
          subtotalAmount {
            amount
            currencyCode
          }
        }
      }
    }
  `;

  const data = await shopifyFetch(query, { cartId });
  return data.cart;
}

// ============================================
// CART STATE HELPERS
// ============================================

function parseCart(cart) {
  if (!cart) return { id: null, lines: [], subtotal: '0.00', checkoutUrl: '' };

  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    subtotal: cart.cost.subtotalAmount.amount,
    lines: cart.lines.edges.map((e) => ({
      id: e.node.id,
      quantity: e.node.quantity,
      variantId: e.node.merchandise.id,
      variantTitle: e.node.merchandise.title,
      productTitle: e.node.merchandise.product.title,
      price: e.node.merchandise.price.amount,
      imageUrl: e.node.merchandise.image?.url || '',
      imageAlt: e.node.merchandise.image?.altText || e.node.merchandise.product.title,
    })),
  };
}

function saveCartId(cartId) {
  if (cartId) {
    localStorage.setItem('ff405_cart_id', cartId);
  } else {
    localStorage.removeItem('ff405_cart_id');
  }
}

function getSavedCartId() {
  return localStorage.getItem('ff405_cart_id');
}

function getCartItemCount() {
  return state.cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

// ============================================
// UI RENDERERS
// ============================================

function optimizeImageUrl(url, width) {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.searchParams.set('width', width);
    return u.toString();
  } catch {
    return url;
  }
}

function renderProducts(products) {
  dom.skeletonGrid.style.display = 'none';
  dom.productGrid.style.display = '';

  if (products.length === 0) {
    dom.productGrid.innerHTML =
      '<p style="text-align:center;color:var(--color-text-muted);grid-column:1/-1;padding:40px 0;">We\'re updating our menu. Check back soon!</p>';
    return;
  }

  dom.productGrid.innerHTML = products
    .map((product) => {
      const image = product.images.edges[0]?.node;
      const variants = product.variants.edges.map((e) => e.node);
      const defaultVariant = variants[0];
      const hasMultipleVariants = variants.length > 1;
      const isAvailable = variants.some((v) => v.availableForSale);

      const imgSrc = image ? optimizeImageUrl(image.url, 600) : '';
      const imgAlt = image?.altText || product.title;

      let variantHtml = '';
      if (hasMultipleVariants) {
        const options = variants
          .map(
            (v) =>
              `<option value="${v.id}" data-price="${v.price.amount}" ${!v.availableForSale ? 'disabled' : ''}>${v.title}${!v.availableForSale ? ' (Sold Out)' : ''} — $${parseFloat(v.price.amount).toFixed(2)}</option>`
          )
          .join('');
        variantHtml = `
          <div class="product-card__variants">
            <label class="product-card__variant-label" for="variant-${defaultVariant.id}">Option</label>
            <select class="product-card__variant-select" id="variant-${defaultVariant.id}" data-product-id="${product.id}">
              ${options}
            </select>
          </div>`;
      }

      return `
        <article class="product-card" data-product-id="${product.id}">
          <div class="product-card__img-wrap" data-action="view-product" data-product-id="${product.id}" role="button" tabindex="0" aria-label="View ${product.title} details">
            ${imgSrc ? `<img class="product-card__img" src="${imgSrc}" alt="${imgAlt}" loading="lazy" width="${image?.width || 600}" height="${image?.height || 450}">` : ''}
          </div>
          <div class="product-card__body">
            <h3 class="product-card__title" data-action="view-product" data-product-id="${product.id}" role="button" tabindex="0">${product.title}</h3>
            <p class="product-card__description">${product.description || ''}</p>
            <p class="product-card__price" data-default-price="${defaultVariant.price.amount}">$${parseFloat(defaultVariant.price.amount).toFixed(2)}</p>
            ${!isAvailable ? '<p class="product-card__sold-out">Sold Out</p>' : ''}
            ${variantHtml}
            ${
              isAvailable
                ? `<div class="product-card__actions">
                    <div class="qty-control">
                      <button class="qty-control__btn" type="button" data-action="qty-minus" aria-label="Decrease quantity">−</button>
                      <span class="qty-control__value" data-qty="1">1</span>
                      <button class="qty-control__btn" type="button" data-action="qty-plus" aria-label="Increase quantity">+</button>
                    </div>
                    <button class="btn btn--primary btn--sm product-card__add-btn" type="button" data-action="add-to-cart" data-variant-id="${defaultVariant.id}">Add to Cart</button>
                  </div>`
                : ''
            }
          </div>
        </article>`;
    })
    .join('');
}

function renderCart() {
  const { lines, subtotal, checkoutUrl } = state.cart;

  if (lines.length === 0) {
    dom.cartEmpty.style.display = '';
    dom.cartFooter.style.display = 'none';
    // Remove line items but keep empty message
    const items = dom.cartItems.querySelectorAll('.cart-item');
    items.forEach((el) => el.remove());
    return;
  }

  dom.cartEmpty.style.display = 'none';
  dom.cartFooter.style.display = '';
  dom.cartSubtotal.textContent = `$${parseFloat(subtotal).toFixed(2)}`;
  dom.checkoutBtn.href = checkoutUrl;

  // Build line items HTML
  const existingItems = dom.cartItems.querySelectorAll('.cart-item');
  existingItems.forEach((el) => el.remove());

  const html = lines
    .map(
      (line) => `
      <div class="cart-item" data-line-id="${line.id}">
        ${line.imageUrl ? `<img class="cart-item__img" src="${optimizeImageUrl(line.imageUrl, 128)}" alt="${line.imageAlt}" width="64" height="64" loading="lazy">` : '<div class="cart-item__img" style="background:#f3f4f6;"></div>'}
        <div class="cart-item__info">
          <p class="cart-item__title">${line.productTitle}</p>
          ${line.variantTitle !== 'Default Title' ? `<p class="cart-item__variant">${line.variantTitle}</p>` : ''}
          <div class="cart-item__bottom">
            <div class="cart-item__qty">
              <button class="cart-item__qty-btn" type="button" data-action="cart-qty-minus" data-line-id="${line.id}" aria-label="Decrease quantity">−</button>
              <span class="cart-item__qty-val">${line.quantity}</span>
              <button class="cart-item__qty-btn" type="button" data-action="cart-qty-plus" data-line-id="${line.id}" aria-label="Increase quantity">+</button>
            </div>
            <span class="cart-item__price">$${(parseFloat(line.price) * line.quantity).toFixed(2)}</span>
          </div>
          <button class="cart-item__remove" type="button" data-action="cart-remove" data-line-id="${line.id}">Remove</button>
        </div>
      </div>`
    )
    .join('');

  dom.cartEmpty.insertAdjacentHTML('beforebegin', html);
}

function renderCartBadge() {
  const count = getCartItemCount();
  dom.cartBadge.textContent = count;
  dom.cartBadge.setAttribute('data-count', count);
  dom.cartToggle.setAttribute('aria-label', `Shopping cart, ${count} item${count !== 1 ? 's' : ''}`);

  // Bump animation
  dom.cartBadge.classList.remove('header__cart-badge--bump');
  void dom.cartBadge.offsetWidth; // Force reflow
  dom.cartBadge.classList.add('header__cart-badge--bump');
}

function showError(message) {
  dom.skeletonGrid.style.display = 'none';
  dom.productGrid.style.display = 'none';
  dom.errorState.style.display = '';
  dom.errorMessage.textContent = message;
}

function showToast(message, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast${type ? ` toast--${type}` : ''}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============================================
// PRODUCT DETAIL MODAL
// ============================================

let modalPreviousFocus = null;

function openProductModal(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  renderProductModal(product);

  modalPreviousFocus = document.activeElement;
  dom.productModal.classList.add('product-modal--open');
  dom.productModal.setAttribute('aria-hidden', 'false');
  dom.modalOverlay.classList.add('modal-overlay--visible');
  dom.modalOverlay.setAttribute('aria-hidden', 'false');
  dom.modalClose.focus();
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  dom.productModal.classList.remove('product-modal--open');
  dom.productModal.setAttribute('aria-hidden', 'true');
  dom.modalOverlay.classList.remove('modal-overlay--visible');
  dom.modalOverlay.setAttribute('aria-hidden', 'true');

  if (!state.cartOpen) {
    document.body.style.overflow = '';
  }

  if (modalPreviousFocus) modalPreviousFocus.focus();
}

function renderProductModal(product) {
  const images = product.images.edges.map((e) => e.node);
  const variants = product.variants.edges.map((e) => e.node);
  const defaultVariant = variants[0];
  const hasMultipleVariants = variants.length > 1;
  const isAvailable = variants.some((v) => v.availableForSale);

  // Gallery
  const mainImgUrl = images[0] ? optimizeImageUrl(images[0].url, 800) : '';
  const mainImgAlt = images[0]?.altText || product.title;

  let thumbsHtml = '';
  if (images.length > 1) {
    thumbsHtml = `<div class="product-modal__thumbs">
      ${images.map((img, i) => `<img class="product-modal__thumb${i === 0 ? ' product-modal__thumb--active' : ''}" src="${optimizeImageUrl(img.url, 128)}" alt="${img.altText || product.title}" data-full-url="${optimizeImageUrl(img.url, 800)}" data-index="${i}">`).join('')}
    </div>`;
  }

  dom.modalGallery.innerHTML = `
    ${mainImgUrl ? `<img class="product-modal__main-img" id="modal-main-img" src="${mainImgUrl}" alt="${mainImgAlt}">` : ''}
    ${thumbsHtml}
  `;

  // Thumbnail click handler
  dom.modalGallery.addEventListener('click', (e) => {
    const thumb = e.target.closest('.product-modal__thumb');
    if (!thumb) return;
    const mainImg = document.getElementById('modal-main-img');
    if (mainImg) mainImg.src = thumb.dataset.fullUrl;
    dom.modalGallery.querySelectorAll('.product-modal__thumb').forEach((t) => t.classList.remove('product-modal__thumb--active'));
    thumb.classList.add('product-modal__thumb--active');
  });

  // Variant selector
  let variantHtml = '';
  if (hasMultipleVariants) {
    const options = variants
      .map(
        (v) =>
          `<option value="${v.id}" data-price="${v.price.amount}" ${!v.availableForSale ? 'disabled' : ''}>${v.title}${!v.availableForSale ? ' (Sold Out)' : ''} — $${parseFloat(v.price.amount).toFixed(2)}</option>`
      )
      .join('');
    variantHtml = `
      <div class="product-modal__variants">
        <label class="product-modal__variant-label" for="modal-variant-select">Option</label>
        <select class="product-modal__variant-select" id="modal-variant-select">
          ${options}
        </select>
      </div>`;
  }

  // Use descriptionHtml if available, else plain description
  const descriptionContent = product.descriptionHtml || product.description || 'No description available.';

  dom.modalInfo.innerHTML = `
    <h2 class="product-modal__title">${product.title}</h2>
    <p class="product-modal__price" id="modal-price">$${parseFloat(defaultVariant.price.amount).toFixed(2)}</p>
    <div class="product-modal__description">${descriptionContent}</div>
    ${!isAvailable ? '<p class="product-card__sold-out">Sold Out</p>' : ''}
    ${variantHtml}
    ${isAvailable ? `
      <div class="product-modal__actions">
        <div class="qty-control">
          <button class="qty-control__btn" type="button" data-action="modal-qty-minus" aria-label="Decrease quantity">−</button>
          <span class="qty-control__value" id="modal-qty" data-qty="1">1</span>
          <button class="qty-control__btn" type="button" data-action="modal-qty-plus" aria-label="Increase quantity">+</button>
        </div>
        <button class="btn btn--primary product-modal__add-btn" type="button" data-action="modal-add-to-cart" data-variant-id="${defaultVariant.id}">Add to Cart</button>
      </div>` : ''}
  `;

  // Variant change handler
  const variantSelect = document.getElementById('modal-variant-select');
  if (variantSelect) {
    variantSelect.addEventListener('change', (e) => {
      const selectedOption = e.target.options[e.target.selectedIndex];
      document.getElementById('modal-price').textContent = `$${parseFloat(selectedOption.dataset.price).toFixed(2)}`;
      const addBtn = dom.modalInfo.querySelector('[data-action="modal-add-to-cart"]');
      if (addBtn) {
        addBtn.dataset.variantId = e.target.value;
        if (selectedOption.disabled) {
          addBtn.disabled = true;
          addBtn.textContent = 'Sold Out';
        } else {
          addBtn.disabled = false;
          addBtn.textContent = 'Add to Cart';
        }
      }
    });
  }
}

// ============================================
// CART DRAWER
// ============================================

let previousFocus = null;

function openCart() {
  state.cartOpen = true;
  previousFocus = document.activeElement;
  dom.cartDrawer.classList.add('cart-drawer--open');
  dom.cartDrawer.setAttribute('aria-hidden', 'false');
  dom.overlay.classList.add('overlay--visible');
  dom.overlay.setAttribute('aria-hidden', 'false');
  dom.cartClose.focus();
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  state.cartOpen = false;
  dom.cartDrawer.classList.remove('cart-drawer--open');
  dom.cartDrawer.setAttribute('aria-hidden', 'true');
  dom.overlay.classList.remove('overlay--visible');
  dom.overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (previousFocus) previousFocus.focus();
}

function trapFocus(e) {
  if (!state.cartOpen) return;

  const focusable = dom.cartDrawer.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.key === 'Tab') {
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

function setupEvents() {
  // Cart toggle
  dom.cartToggle.addEventListener('click', () => {
    state.cartOpen ? closeCart() : openCart();
  });

  dom.cartClose.addEventListener('click', closeCart);
  dom.overlay.addEventListener('click', closeCart);

  // Product modal
  dom.modalClose.addEventListener('click', closeProductModal);
  dom.modalOverlay.addEventListener('click', closeProductModal);

  // Modal info — event delegation for qty and add-to-cart
  dom.modalInfo.addEventListener('click', handleModalAction);

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.cartOpen) closeCart();
      else if (dom.productModal.classList.contains('product-modal--open')) closeProductModal();
    }
  });

  // Focus trap
  document.addEventListener('keydown', trapFocus);

  // Retry button
  dom.retryBtn.addEventListener('click', loadProducts);

  // Product grid — event delegation
  dom.productGrid.addEventListener('click', handleProductAction);

  // Cart items — event delegation
  dom.cartItems.addEventListener('click', handleCartAction);

  // Keyboard activation for product image/title (Enter or Space opens modal)
  dom.productGrid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const el = e.target.closest('[data-action="view-product"]');
      if (el) {
        e.preventDefault();
        openProductModal(el.dataset.productId);
      }
    }
  });

  // Variant select change
  dom.productGrid.addEventListener('change', handleVariantChange);

  // Header scroll shadow
  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      requestAnimationFrame(() => {
        dom.header.classList.toggle('header--scrolled', window.scrollY > 10);
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  });

  // Checkout button
  dom.checkoutBtn.addEventListener('click', (e) => {
    if (!state.cart.checkoutUrl) {
      e.preventDefault();
      showToast('Cart is empty', 'error');
    }
  });
}

function handleVariantChange(e) {
  if (!e.target.matches('.product-card__variant-select')) return;

  const card = e.target.closest('.product-card');
  const selectedOption = e.target.options[e.target.selectedIndex];
  const price = selectedOption.dataset.price;
  const variantId = e.target.value;

  card.querySelector('.product-card__price').textContent = `$${parseFloat(price).toFixed(2)}`;

  const addBtn = card.querySelector('[data-action="add-to-cart"]');
  if (addBtn) {
    addBtn.dataset.variantId = variantId;

    if (selectedOption.disabled) {
      addBtn.disabled = true;
      addBtn.textContent = 'Sold Out';
    } else {
      addBtn.disabled = false;
      addBtn.textContent = 'Add to Cart';
    }
  }
}

function handleProductAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  // View product modal
  if (btn.dataset.action === 'view-product') {
    openProductModal(btn.dataset.productId);
    return;
  }

  const card = btn.closest('.product-card');
  const qtyEl = card.querySelector('.qty-control__value');
  let qty = parseInt(qtyEl.dataset.qty, 10);

  switch (btn.dataset.action) {
    case 'qty-minus':
      qty = Math.max(1, qty - 1);
      qtyEl.dataset.qty = qty;
      qtyEl.textContent = qty;
      break;

    case 'qty-plus':
      qty = Math.min(99, qty + 1);
      qtyEl.dataset.qty = qty;
      qtyEl.textContent = qty;
      break;

    case 'add-to-cart':
      handleAddToCart(btn.dataset.variantId, qty, card);
      break;
  }
}

function handleModalAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const qtyEl = document.getElementById('modal-qty');

  switch (btn.dataset.action) {
    case 'modal-qty-minus': {
      let qty = Math.max(1, parseInt(qtyEl.dataset.qty, 10) - 1);
      qtyEl.dataset.qty = qty;
      qtyEl.textContent = qty;
      break;
    }
    case 'modal-qty-plus': {
      let qty = Math.min(99, parseInt(qtyEl.dataset.qty, 10) + 1);
      qtyEl.dataset.qty = qty;
      qtyEl.textContent = qty;
      break;
    }
    case 'modal-add-to-cart': {
      const qty = parseInt(qtyEl.dataset.qty, 10);
      handleModalAddToCart(btn.dataset.variantId, qty);
      break;
    }
  }
}

async function handleModalAddToCart(variantId, quantity) {
  const addBtn = dom.modalInfo.querySelector('[data-action="modal-add-to-cart"]');
  const originalText = addBtn.textContent;
  addBtn.disabled = true;
  addBtn.textContent = 'Adding...';

  try {
    let cart;
    if (state.cart.id) {
      cart = await addToCart(state.cart.id, variantId, quantity);
    } else {
      cart = await createCart(variantId, quantity);
    }

    state.cart = parseCart(cart);
    saveCartId(state.cart.id);
    renderCart();
    renderCartBadge();
    closeProductModal();
    openCart();

    showToast('Added to cart', 'success');
  } catch (err) {
    console.error('Modal add to cart error:', err);

    if (err.message.includes('not found') || err.message.includes('invalid')) {
      state.cart = parseCart(null);
      saveCartId(null);
      try {
        const cart = await createCart(variantId, quantity);
        state.cart = parseCart(cart);
        saveCartId(state.cart.id);
        renderCart();
        renderCartBadge();
        closeProductModal();
        openCart();
        showToast('Added to cart', 'success');
        return;
      } catch (retryErr) {
        console.error('Retry error:', retryErr);
      }
    }

    showToast('Couldn\'t add to cart. Please try again.', 'error');
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = originalText;
  }
}

async function handleAddToCart(variantId, quantity, card) {
  const addBtn = card.querySelector('[data-action="add-to-cart"]');
  const originalText = addBtn.textContent;
  addBtn.disabled = true;
  addBtn.textContent = 'Adding...';

  try {
    let cart;
    if (state.cart.id) {
      cart = await addToCart(state.cart.id, variantId, quantity);
    } else {
      cart = await createCart(variantId, quantity);
    }

    state.cart = parseCart(cart);
    saveCartId(state.cart.id);
    renderCart();
    renderCartBadge();
    openCart();

    const title = card.querySelector('.product-card__title').textContent;
    showToast(`${title} added to cart`, 'success');

    // Reset quantity to 1
    const qtyEl = card.querySelector('.qty-control__value');
    qtyEl.dataset.qty = 1;
    qtyEl.textContent = '1';
  } catch (err) {
    console.error('Add to cart error:', err);

    // If cart is invalid (e.g., expired), clear and retry
    if (err.message.includes('not found') || err.message.includes('invalid')) {
      state.cart = parseCart(null);
      saveCartId(null);
      try {
        const cart = await createCart(variantId, quantity);
        state.cart = parseCart(cart);
        saveCartId(state.cart.id);
        renderCart();
        renderCartBadge();
        openCart();
        showToast('Added to cart', 'success');
        return;
      } catch (retryErr) {
        console.error('Retry error:', retryErr);
      }
    }

    showToast('Couldn\'t add to cart. Please try again.', 'error');
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = originalText;
  }
}

async function handleCartAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const lineId = btn.dataset.lineId;
  const line = state.cart.lines.find((l) => l.id === lineId);
  if (!line) return;

  try {
    let cart;
    switch (btn.dataset.action) {
      case 'cart-qty-minus':
        if (line.quantity <= 1) {
          cart = await removeCartLine(state.cart.id, lineId);
        } else {
          cart = await updateCartLine(state.cart.id, lineId, line.quantity - 1);
        }
        break;

      case 'cart-qty-plus':
        cart = await updateCartLine(state.cart.id, lineId, line.quantity + 1);
        break;

      case 'cart-remove':
        cart = await removeCartLine(state.cart.id, lineId);
        showToast('Item removed from cart');
        break;
    }

    if (cart) {
      state.cart = parseCart(cart);
      renderCart();
      renderCartBadge();

      if (state.cart.lines.length === 0) {
        saveCartId(null);
      }
    }
  } catch (err) {
    console.error('Cart action error:', err);
    showToast('Couldn\'t update cart. Please try again.', 'error');
  }
}

// ============================================
// INITIALIZATION
// ============================================

async function loadProducts() {
  dom.skeletonGrid.style.display = '';
  dom.productGrid.style.display = 'none';
  dom.errorState.style.display = 'none';

  try {
    state.products = await fetchCollectionProducts();
    renderProducts(state.products);
  } catch (err) {
    console.error('Failed to load products:', err);
    showError('We\'re having trouble loading our menu. Please check your connection and try again.');
  }
}

async function restoreCart() {
  const savedCartId = getSavedCartId();
  if (!savedCartId) return;

  try {
    const cart = await fetchCart(savedCartId);
    if (cart && cart.lines.edges.length > 0) {
      state.cart = parseCart(cart);
      renderCart();
      renderCartBadge();
    } else {
      saveCartId(null);
    }
  } catch (err) {
    console.error('Failed to restore cart:', err);
    saveCartId(null);
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.log('SW registration skipped:', err.message);
    });
  }
}

function setupOfflineDetection() {
  function updateOnlineStatus() {
    const existing = document.querySelector('.offline-banner');
    if (!navigator.onLine) {
      if (!existing) {
        const banner = document.createElement('div');
        banner.className = 'offline-banner';
        banner.textContent = 'You\'re offline. Some features may be unavailable.';
        document.body.prepend(banner);
      }
    } else if (existing) {
      existing.remove();
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  setupEvents();
  setupOfflineDetection();
  loadProducts();
  restoreCart();
  registerServiceWorker();
});
