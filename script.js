document.addEventListener('DOMContentLoaded', () => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-links a[data-page]');
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav-links');

  navLinks.forEach((link) => {
    const target = link.dataset.page === 'home' ? 'index.html' : `${link.dataset.page}.html`;
    if (currentPage === target) {
      link.classList.add('active');
    }
  });

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.textContent = isOpen ? '×' : '☰';
    });

    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.textContent = '☰';
      });
    });
  }

  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const route = button.dataset.route;
      if (!route) return;
      event.preventDefault();
      window.location.href = route;
    });
  });

  const contactForm = document.querySelector('form[data-contact-form]');
  if (contactForm) {
    const formStatus = contactForm.querySelector('.form-status');
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const fields = Array.from(contactForm.querySelectorAll('input, textarea'));

    const setFieldState = (field, isValid) => {
      field.classList.toggle('invalid', !isValid);
    };

    const showStatus = (message, type) => {
      if (!formStatus) return;
      formStatus.textContent = message;
      formStatus.classList.remove('success', 'error');
      formStatus.classList.add(type);
    };

    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();

      let isValid = true;
      fields.forEach((field) => {
        const value = field.value.trim();
        const isFieldValid = field.name === 'email'
          ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          : value.length > 0;

        setFieldState(field, isFieldValid);
        if (!isFieldValid) {
          isValid = false;
        }
      });

      if (!isValid) {
        showStatus('Veuillez remplir tous les champs correctement.', 'error');
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Envoi...';
      }

      showStatus('Merci ! Votre message a bien été envoyé.', 'success');
      contactForm.reset();

      setTimeout(() => {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Envoyer';
        }
        fields.forEach((field) => setFieldState(field, true));
      }, 1200);
    });
  }

  const ADMIN_PASSWORD = 'admin123';

  const fetchJson = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      headers,
      ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Erreur serveur');
    }

    return data;
  };

  const getImageSources = (imageValue) => {
    if (!imageValue) return [];
    try {
      const parsed = JSON.parse(imageValue);
      return Array.isArray(parsed) ? parsed : [imageValue];
    } catch (error) {
      return [imageValue];
    }
  };

  const initializeCarousels = (root = document) => {
    root.querySelectorAll('[data-carousel]').forEach((carousel) => {
      const slides = Array.from(carousel.querySelectorAll('[data-slide]'));
      const dots = Array.from(carousel.querySelectorAll('[data-slide-dot]'));
      if (slides.length < 2) return;

      let activeIndex = 0;
      let timer;
      const showSlide = (index) => {
        activeIndex = (index + slides.length) % slides.length;
        slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === activeIndex));
        dots.forEach((dot, dotIndex) => {
          dot.classList.toggle('active', dotIndex === activeIndex);
          dot.setAttribute('aria-current', dotIndex === activeIndex ? 'true' : 'false');
        });
      };
      const start = () => {
        clearInterval(timer);
        timer = setInterval(() => showSlide(activeIndex + 1), 4000);
      };

      carousel.querySelector('[data-carousel-next]')?.addEventListener('click', () => {
        showSlide(activeIndex + 1);
        start();
      });
      carousel.querySelector('[data-carousel-prev]')?.addEventListener('click', () => {
        showSlide(activeIndex - 1);
        start();
      });
      dots.forEach((dot, dotIndex) => dot.addEventListener('click', () => {
        showSlide(dotIndex);
        start();
      }));
      carousel.addEventListener('mouseenter', () => clearInterval(timer));
      carousel.addEventListener('mouseleave', start);
      showSlide(0);
      start();
    });
  };

  const renderNewsCards = async () => {
    const newsContainer = document.querySelector('[data-news-list]');
    if (!newsContainer) return;

    try {
      const items = await fetchJson('/api/news');
      if (!items.length) {
        newsContainer.innerHTML = '<div class="news-empty">Aucune actualité publiée pour le moment.</div>';
        return;
      }

      newsContainer.innerHTML = items.map((item) => {
        const imageSources = getImageSources(item.image);
        const imageMarkup = imageSources.length
          ? `<div class="news-carousel" data-carousel>
              <div class="news-slides">
                ${imageSources.map((source, index) => `<img class="news-image${index === 0 ? ' active' : ''}" data-slide src="${source}" alt="${item.title} - image ${index + 1}" />`).join('')}
              </div>
              ${imageSources.length > 1 ? `<button class="carousel-control carousel-prev" type="button" data-carousel-prev aria-label="Image précédente">‹</button>
              <button class="carousel-control carousel-next" type="button" data-carousel-next aria-label="Image suivante">›</button>
              <div class="carousel-dots">${imageSources.map((source, index) => `<button class="carousel-dot${index === 0 ? ' active' : ''}" type="button" data-slide-dot aria-label="Afficher l'image ${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}"></button>`).join('')}</div>` : ''}
            </div>`
          : '';
        const videoMarkup = item.video
          ? (String(item.video).startsWith('/uploads/')
            ? `<video class="video-frame" src="${item.video}" controls></video>`
            : `<iframe class="video-frame" src="${String(item.video).replace('watch?v=', 'embed/')}" allowfullscreen></iframe>`)
          : '';
        const buttonLabel = item.buttonText || 'En savoir plus';

        return `
          <article class="news-card">
            ${imageMarkup || videoMarkup || '<div class="news-image" style="background-image:url(\'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=900&q=80\');"></div>'}
            <div class="news-content">
              <div class="meta">${item.category}</div>
              <h3>${item.title}</h3>
              <p>${item.description}</p>
              <a href="contact.html" class="btn btn-secondary" data-route="contact.html">${buttonLabel}</a>
            </div>
          </article>
        `;
      }).join('');

      initializeCarousels(newsContainer);

      document.querySelectorAll('[data-route]').forEach((button) => {
        button.addEventListener('click', (event) => {
          const route = button.dataset.route;
          if (!route) return;
          event.preventDefault();
          window.location.href = route;
        });
      });
    } catch (error) {
      newsContainer.innerHTML = '<div class="news-empty">Impossible de charger les actualités.</div>';
    }
  };

  const loginBox = document.querySelector('[data-admin-login]');
  const adminPanel = document.querySelector('[data-admin-panel]');
  const adminForm = document.querySelector('[data-admin-form]');
  const adminList = document.querySelector('[data-admin-list]');
  const adminMessages = document.querySelector('[data-admin-messages]');

  const setAdminView = (isLoggedIn) => {
    if (loginBox) loginBox.classList.toggle('hidden', isLoggedIn);
    if (adminPanel) adminPanel.classList.toggle('hidden', !isLoggedIn);
  };

  const isAdminAuthenticated = () => sessionStorage.getItem('eglise-lumiere-admin') === 'true';
  if (loginBox) {
    setAdminView(isAdminAuthenticated());

    loginBox.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const passwordInput = loginBox.querySelector('input[name="password"]');
      const statusEl = loginBox.querySelector('.form-status');
      const value = passwordInput.value.trim();

      if (value !== ADMIN_PASSWORD) {
        statusEl.textContent = 'Mot de passe incorrect.';
        statusEl.classList.remove('success');
        statusEl.classList.add('error');
        return;
      }

      sessionStorage.setItem('eglise-lumiere-admin', 'true');
      setAdminView(true);
      statusEl.textContent = '';
      passwordInput.value = '';
    });
  }

  if (adminForm) {
    adminForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(adminForm);
      const title = String(formData.get('title') || '').trim();
      const category = String(formData.get('category') || '').trim();
      const description = String(formData.get('description') || '').trim();
      const buttonText = String(formData.get('buttonText') || '').trim();
      const statusEl = adminForm.querySelector('.form-status');

      if (!title || !category || !description) {
        statusEl.textContent = 'Veuillez remplir le titre, la catégorie et la description.';
        statusEl.classList.remove('success');
        statusEl.classList.add('error');
        return;
      }

      fetchJson('/api/news', {
        method: 'POST',
        body: formData
      })
        .then(() => {
          adminForm.reset();
          statusEl.textContent = 'Actualité publiée avec succès.';
          statusEl.classList.remove('error');
          statusEl.classList.add('success');
          renderAdminList();
          renderNewsCards();
        })
        .catch((error) => {
          statusEl.textContent = error.message || 'Impossible de publier l\'actualité.';
          statusEl.classList.remove('success');
          statusEl.classList.add('error');
        });
    });
  }

  const renderAdminList = async () => {
    if (!adminList) return;

    try {
      const items = await fetchJson('/api/news');

      if (!items.length) {
        adminList.innerHTML = '<div class="admin-item"><p>Aucune publication.</p></div>';
        return;
      }

      adminList.innerHTML = items.map((item) => {
        const imageMarkup = getImageSources(item.image).map((source) => `<img class="admin-thumb" src="${source}" alt="${item.title}" />`).join('');
        const videoMarkup = item.video
          ? (String(item.video).startsWith('/uploads/')
            ? `<video class="video-frame" src="${item.video}" controls></video>`
            : `<iframe class="video-frame" src="${String(item.video).replace('watch?v=', 'embed/')}" allowfullscreen></iframe>`)
          : '';
        return `
          <div class="admin-item">
            <div class="admin-item-header">
              <strong>${item.title}</strong>
              <div class="admin-item-actions">
                <button type="button" class="btn btn-secondary" data-delete-id="${item.id}">Supprimer</button>
              </div>
            </div>
            ${imageMarkup}
            ${videoMarkup}
            <p><strong>Catégorie :</strong> ${item.category}</p>
            <p>${item.description}</p>
          </div>
        `;
      }).join('');

      adminList.querySelectorAll('[data-delete-id]').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = Number(button.getAttribute('data-delete-id'));
          try {
            await fetchJson(`/api/news/${id}`, { method: 'DELETE' });
            renderNewsCards();
            renderAdminList();
          } catch (error) {
            console.error(error);
          }
        });
      });
    } catch (error) {
      adminList.innerHTML = '<div class="admin-item"><p>Impossible de charger les publications.</p></div>';
    }
  };

  const renderAdminMessages = async () => {
    if (!adminMessages) return;

    try {
      const items = await fetchJson('/api/messages');
      if (!items.length) {
        adminMessages.innerHTML = '<div class="admin-item"><p>Aucun message reçu.</p></div>';
        return;
      }

      adminMessages.innerHTML = items.map((item) => `
        <article class="admin-item">
          <div class="admin-item-header">
            <strong>${item.name}</strong>
            <a class="message-email" href="mailto:${item.email}">${item.email}</a>
          </div>
          <p class="message-date">${new Date(item.created_at).toLocaleString('fr-FR')}</p>
          <p>${item.message}</p>
        </article>
      `).join('');
    } catch (error) {
      adminMessages.innerHTML = '<div class="admin-item"><p>Impossible de charger les messages.</p></div>';
    }
  };

  if (document.querySelector('[data-admin-list]')) {
    renderAdminList();
    renderAdminMessages();
  }

  const logoutButton = document.querySelector('[data-admin-logout]');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      sessionStorage.removeItem('eglise-lumiere-admin');
      setAdminView(false);
    });
  }

  renderNewsCards();

  const form = document.querySelector('form[data-contact-form]');
  if (form) {
    form.addEventListener('submit', async (event) => {
      const statusEl = form.querySelector('.form-status');
      const fields = Array.from(form.querySelectorAll('input, textarea'));
      const name = form.querySelector('#nom')?.value?.trim();
      const email = form.querySelector('#email')?.value?.trim();
      const message = form.querySelector('#message')?.value?.trim();

      if (!name || !email || !message) {
        statusEl.textContent = 'Veuillez remplir tous les champs.';
        statusEl.classList.remove('success');
        statusEl.classList.add('error');
        return;
      }

      try {
        await fetchJson('/api/contact', {
          method: 'POST',
          body: JSON.stringify({ name, email, message })
        });

        statusEl.textContent = 'Merci ! Votre message a bien été envoyé.';
        statusEl.classList.remove('error');
        statusEl.classList.add('success');
        form.reset();
        fields.forEach((field) => field.classList.remove('invalid'));
      } catch (error) {
        statusEl.textContent = error.message || 'Impossible d\'envoyer le message.';
        statusEl.classList.remove('success');
        statusEl.classList.add('error');
      }
    });
  }
});
