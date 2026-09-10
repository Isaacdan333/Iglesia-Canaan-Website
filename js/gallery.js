const photoAlbums = {
	church: {
		title: "Church Life",
		description: "See the church, the people, and the welcoming spaces where our community gathers.",
		images: [
			["images/church/outside-church-building.png", "Church building"],
			["images/church/outside-church.png", "Church exterior"],
			["images/church/pastor.png", "Pastor"]
		]
	},
	events: {
		title: "Events",
		description: "Remember the worship, fellowship, and shared moments that bring us together.",
		images: [
			["images/events/worship.png", "Prayer"],
			["images/events/worship2.png", "Worship gathering"],
			["images/events/worship3.png", "Church gathering"]
		]
	},
	ministries: {
		title: "Ministries",
		description: "A look at the lessons, prayer, and service that shape our church family.",
		images: [
			["images/ministries/lessons.png", "Lessons"],
			["images/ministries/prayer.png", "Prayer"]
		]
	},
	youth: {
		title: "Youth Ministry",
		description: "Snapshots of young people growing in faith, friendship, and purpose.",
		images: [["images/youth/youth-worship.png", "Youth worship"]]
	}
};

const albumOrder = Object.keys(photoAlbums);
const allPhotos = albumOrder.flatMap((albumKey) =>
	photoAlbums[albumKey].images.map(([src, caption]) => ({ src, caption, albumKey }))
);

function createPhotoCard(photo, openPhoto) {
	const figure = document.createElement("figure");
	figure.className = "photo-card reveal-item";

	const button = document.createElement("button");
	button.type = "button";
	button.setAttribute("aria-label", `View ${photo.caption}`);
	button.addEventListener("click", openPhoto);

	const image = document.createElement("img");
	image.src = photo.src;
	image.alt = photo.caption;
	image.loading = "lazy";

	const caption = document.createElement("figcaption");
	caption.textContent = photo.caption;

	button.append(image);
	figure.append(button, caption);
	return figure;
}

function createLightbox() {
	const lightbox = document.createElement("div");
	lightbox.className = "lightbox";
	lightbox.hidden = true;
	lightbox.setAttribute("role", "dialog");
	lightbox.setAttribute("aria-modal", "true");
	lightbox.setAttribute("aria-label", "Photo viewer");
	lightbox.innerHTML = `
		<div class="lightbox-content">
			<button class="lightbox-close" type="button" aria-label="Close photo viewer">&times;</button>
			<button class="lightbox-prev" type="button" aria-label="Previous photo">&#8249;</button>
			<img class="lightbox-image" alt="" />
			<button class="lightbox-next" type="button" aria-label="Next photo">&#8250;</button>
			<p class="lightbox-caption"></p>
		</div>
	`;
	document.body.append(lightbox);
	return lightbox;
}

function setupLightbox(photos) {
	const lightbox = createLightbox();
	const image = lightbox.querySelector(".lightbox-image");
	const caption = lightbox.querySelector(".lightbox-caption");
	let currentIndex = 0;

	const showPhoto = (index) => {
		currentIndex = (index + photos.length) % photos.length;
		const photo = photos[currentIndex];
		image.src = photo.src;
		image.alt = photo.caption;
		caption.textContent = photo.caption;
		lightbox.hidden = false;
		document.body.style.overflow = "hidden";
	};

	const close = () => {
		lightbox.hidden = true;
		document.body.style.overflow = "";
	};

	lightbox.querySelector(".lightbox-close").addEventListener("click", close);
	lightbox.querySelector(".lightbox-prev").addEventListener("click", () => showPhoto(currentIndex - 1));
	lightbox.querySelector(".lightbox-next").addEventListener("click", () => showPhoto(currentIndex + 1));
	lightbox.addEventListener("click", (event) => {
		if (event.target === lightbox) close();
	});
	document.addEventListener("keydown", (event) => {
		if (lightbox.hidden) return;
		if (event.key === "Escape") close();
		if (event.key === "ArrowLeft") showPhoto(currentIndex - 1);
		if (event.key === "ArrowRight") showPhoto(currentIndex + 1);
	});

	return showPhoto;
}

function createPhotoGrid(photos, openPhoto) {
	const grid = document.createElement("div");
	grid.className = "photo-grid";
	photos.forEach((photo, index) => {
		grid.append(createPhotoCard(photo, () => openPhoto(index)));
	});
	return grid;
}

function renderPageAlbum() {
	const section = document.querySelector("[data-photo-album]");
	if (!section) return;

	const albumKey = section.dataset.photoAlbum;
	const album = photoAlbums[albumKey];
	if (!album) return;

	const openPhoto = setupLightbox(allPhotos);
	const albumPhotos = allPhotos.filter((photo) => photo.albumKey === albumKey);
	const container = document.createElement("div");
	container.className = "container";
	container.innerHTML = `
		<div class="photo-heading">
			<p class="section-tag">${album.title}</p>
			<h2>See our church family in the moments that matter.</h2>
			<p>${album.description}</p>
		</div>
	`;
	container.append(createPhotoGrid(albumPhotos, (index) => openPhoto(allPhotos.indexOf(albumPhotos[index]))));
	const link = document.createElement("p");
	link.className = "photo-link";
	link.innerHTML = '<a class="button secondary" href="gallery.html">View all photos</a>';
	container.append(link);
	section.append(container);
}

function renderGalleryPage() {
	const gallery = document.querySelector("[data-gallery-page]");
	if (!gallery) return;

	const openPhoto = setupLightbox(allPhotos);
	const filters = document.createElement("div");
	filters.className = "album-filter";
	const grid = document.createElement("div");
	grid.className = "photo-grid";
	const allButton = document.createElement("button");
	allButton.type = "button";
	allButton.className = "active";
	allButton.textContent = "All photos";
	filters.append(allButton);

	const showPhotos = (photos, activeButton) => {
		grid.replaceChildren();
		photos.forEach((photo) => grid.append(createPhotoCard(photo, () => openPhoto(allPhotos.indexOf(photo)))));
		filters.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
		activeButton.classList.add("active");
	};

	allButton.addEventListener("click", () => showPhotos(allPhotos, allButton));
	albumOrder.forEach((albumKey) => {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = photoAlbums[albumKey].title;
		button.addEventListener("click", () => showPhotos(
			allPhotos.filter((photo) => photo.albumKey === albumKey),
			button
		));
		filters.append(button);
	});

	const container = document.createElement("div");
	container.className = "container";
	container.append(filters, grid);
	gallery.append(container);
	showPhotos(allPhotos, allButton);
}

function setupGallerySlideshow() {
	const slideshow = document.querySelector("[data-gallery-slideshow]");
	if (!slideshow || allPhotos.length === 0) return;

	const track = slideshow.querySelector(".gallery-slideshow-track");
	let photoQueue = [];
	let queueIndex = 0;
	let isChanging = false;
	let activeSet;

	const refillQueue = () => {
		photoQueue = [...allPhotos].sort(() => Math.random() - 0.5);
		queueIndex = 0;
	};

	const nextPhotos = () => {
		if (photoQueue.length - queueIndex < 3) refillQueue();
		const photos = Array.from({ length: Math.min(3, allPhotos.length) }, () => {
			const photo = photoQueue[queueIndex];
			queueIndex = (queueIndex + 1) % photoQueue.length;
			return photo;
		});
		return photos;
	};

	const createPhotoSet = (photos) => {
		const photoSet = document.createElement("div");
		photoSet.className = "gallery-slideshow-set";

		const imageLoads = photos.map((photo) => new Promise((resolve) => {
			const image = document.createElement("img");
			image.src = photo.src;
			image.alt = photo.caption;
			image.loading = "eager";
			image.addEventListener("load", resolve, { once: true });
			image.addEventListener("error", resolve, { once: true });
			photoSet.append(image);
		}));

		return { photoSet, imageLoads };
	};

	const showPhotos = (photos, fade = false) => {
		const { photoSet, imageLoads } = createPhotoSet(photos);
		track.append(photoSet);
		if (!fade) {
			photoSet.classList.add("is-active");
			activeSet = photoSet;
			return;
		}

		isChanging = true;
		Promise.all(imageLoads).then(() => {
			window.requestAnimationFrame(() => {
				photoSet.classList.add("is-active");
				activeSet.classList.remove("is-active");
				activeSet = photoSet;
				window.setTimeout(() => {
					track.firstElementChild.remove();
					isChanging = false;
				}, 700);
			});
		});
	};

	refillQueue();
	showPhotos(nextPhotos());
	window.setInterval(() => {
		if (!isChanging) showPhotos(nextPhotos(), true);
	}, 5000);
}

function setupYouthSlideshow() {
	const slideshow = document.querySelector("[data-youth-slideshow]");
	if (!slideshow) return;

	const images = [
		"images/youth/youth-at-beach.jpg",
		"images/youth/gen-luis-dad.jpg",
		"images/youth/youth-at-applepicking.jpg",
		"images/youth/youth-at-museum-entrance.jpg",
		"images/youth/youth-inside-museum-group-photo.jpg",
		"images/youth/universal-studios-group.jpg",
		"images/youth/universal-studios-peach-castle-group-photo.jpg",
		"images/youth/youth-pipe-photo.jpg",
		"images/youth/youth-worship.png"
	];
	const image = slideshow.querySelector(".youth-slideshow-image");
	let currentIndex = 0;

	images.slice(1).forEach((src) => {
		const preload = new Image();
		preload.src = src;
	});

	window.setInterval(() => {
		currentIndex = (currentIndex + 1) % images.length;
		image.classList.add("is-changing");
		window.setTimeout(() => {
			image.src = images[currentIndex];
			image.classList.remove("is-changing");
		}, 700);
	}, 5000);
}

function setupScrollReveals() {
	const revealTargets = document.querySelectorAll(
		"main > section:not(.hero):not(.page-hero), main > section:not(.hero):not(.page-hero) .photo-heading, main > section:not(.hero):not(.page-hero) .feature-card, main > section:not(.hero):not(.page-hero) .ministry-card, main > section:not(.hero):not(.page-hero) .event-card, main > section:not(.hero):not(.page-hero) .cta-box"
	);
	const topCards = document.querySelectorAll(".hero-card, .info-panel, .contact-card");

	revealTargets.forEach((target) => {
		if (![...topCards].some((card) => card.contains(target) || target.contains(card))) {
			target.classList.add(target.matches("article, .photo-heading, .cta-box") ? "reveal-item" : "reveal");
		}
	});

	if (!("IntersectionObserver" in window)) {
		document.querySelectorAll(".reveal, .reveal-item").forEach((target) => target.classList.add("is-visible"));
		return;
	}

	const observer = new IntersectionObserver((entries, currentObserver) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			entry.target.classList.add("is-visible");
			currentObserver.unobserve(entry.target);
		});
	}, { threshold: 0.12 });

	const observeTargets = () => {
		document.querySelectorAll(".reveal, .reveal-item").forEach((target) => observer.observe(target));
	};

	observeTargets();
	document.querySelectorAll(".photo-grid").forEach((grid) => {
		new MutationObserver(observeTargets).observe(grid, { childList: true });
	});
}

renderPageAlbum();
renderGalleryPage();
setupGallerySlideshow();
setupYouthSlideshow();
setupScrollReveals();
