// Store our photo database in local storage
let photos = [];

// Try to load existing photos from IndexedDB first
document.addEventListener('DOMContentLoaded', function() {
    // Check if IndexedDB is supported
    if (!window.indexedDB) {
        console.log("Your browser doesn't support IndexedDB. Using localStorage with limited capacity instead.");
        photos = JSON.parse(localStorage.getItem('concertPhotos')) || [];
        displayPhotos(photos);
        updateGalleryCount(photos);
        return;
    }
    
    // Open/create our database
    const request = indexedDB.open("ConcertPhotosDB", 1);
    
    request.onerror = function(event) {
        console.error("Database error: ", event.target.error);
        // Fall back to localStorage
        photos = JSON.parse(localStorage.getItem('concertPhotos')) || [];
        displayPhotos(photos);
        updateGalleryCount(photos);
    };
    
    request.onupgradeneeded = function(event) {
        const db = event.target.result;
        
        // Create an object store if it doesn't exist
        if (!db.objectStoreNames.contains('photos')) {
            const objectStore = db.createObjectStore('photos', { keyPath: 'id' });
            objectStore.createIndex('band', 'band', { unique: false });
        }
    };
    
    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['photos'], 'readonly');
        const objectStore = transaction.objectStore('photos');
        const getAllRequest = objectStore.getAll();
        
        getAllRequest.onsuccess = function(event) {
            photos = event.target.result;
            displayPhotos(photos);
            updateGalleryCount(photos);
        };
    };
});

// DOM Elements
const uploadForm = document.getElementById('upload-form');
const photoUpload = document.getElementById('photo-upload');
const bandNameInput = document.getElementById('band-name');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const showAllButton = document.getElementById('show-all-button');
const gallery = document.getElementById('gallery');
const galleryCount = document.getElementById('gallery-count');

// Handle photo uploads
uploadForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const files = photoUpload.files;
    if (files.length === 0) {
        alert('Please select at least one photo to upload');
        return;
    }
    
    const bandName = bandNameInput.value.trim();
    if (!bandName) {
        alert('Please enter a band name');
        return;
    }
    
    // Process each selected file
    Array.from(files).forEach(file => {
        // Compress and resize the image before storing
        compressImage(file, 800, 0.7, function(compressedImage) {
            const newPhoto = {
                id: Date.now() + Math.random().toString(36).substring(2, 10), // Create unique ID
                src: compressedImage, // Compressed image as Base64
                band: bandName,
                dateAdded: new Date().toISOString()
            };
            
            // Add to our database
            savePhoto(newPhoto);
        });
    });
    
    // Reset the form
    uploadForm.reset();
});

// Function to compress and resize images
function compressImage(file, maxWidth, quality, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = function(event) {
        const img = new Image();
        img.src = event.target.result;
        
        img.onload = function() {
            // Calculate new dimensions while maintaining aspect ratio
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                const ratio = maxWidth / width;
                width = maxWidth;
                height = height * ratio;
            }
            
            // Create a canvas and draw the resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get the compressed image as base64
            const compressedImage = canvas.toDataURL('image/jpeg', quality);
            callback(compressedImage);
            
            // After compression, update the display
            setTimeout(() => {
                loadAndDisplayPhotos();
            }, 100);
        };
    };
}

// Function to save a photo to IndexedDB
function savePhoto(photo) {
    if (!window.indexedDB) {
        // Fall back to localStorage
        photos.push(photo);
        localStorage.setItem('concertPhotos', JSON.stringify(photos));
        displayPhotos(photos);
        updateGalleryCount(photos);
        return;
    }
    
    const request = indexedDB.open("ConcertPhotosDB", 1);
    
    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['photos'], 'readwrite');
        const objectStore = transaction.objectStore('photos');
        
        const addRequest = objectStore.add(photo);
        
        addRequest.onsuccess = function() {
            console.log("Photo added to database");
            loadAndDisplayPhotos();
        };
        
        addRequest.onerror = function() {
            console.error("Error adding photo to database");
        };
    };
}

// Function to load all photos from IndexedDB
function loadAndDisplayPhotos() {
    if (!window.indexedDB) {
        return;
    }
    
    const request = indexedDB.open("ConcertPhotosDB", 1);
    
    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['photos'], 'readonly');
        const objectStore = transaction.objectStore('photos');
        const getAllRequest = objectStore.getAll();
        
        getAllRequest.onsuccess = function(event) {
            photos = event.target.result;
            displayPhotos(photos);
            updateGalleryCount(photos);
        };
    };
}

// Search functionality
searchButton.addEventListener('click', function() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    if (!searchTerm) {
        loadAndDisplayPhotos();
        return;
    }
    
    if (!window.indexedDB) {
        // Filter in memory if no IndexedDB
        const filteredPhotos = photos.filter(photo => 
            photo.band.toLowerCase().includes(searchTerm)
        );
        displayPhotos(filteredPhotos);
        updateGalleryCount(filteredPhotos);
        return;
    }
    
    // Use IndexedDB to search
    const request = indexedDB.open("ConcertPhotosDB", 1);
    
    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['photos'], 'readonly');
        const objectStore = transaction.objectStore('photos');
        const getAllRequest = objectStore.getAll();
        
        getAllRequest.onsuccess = function(event) {
            const allPhotos = event.target.result;
            const filteredPhotos = allPhotos.filter(photo => 
                photo.band.toLowerCase().includes(searchTerm)
            );
            displayPhotos(filteredPhotos);
            updateGalleryCount(filteredPhotos);
        };
    };
});

// Show all photos
showAllButton.addEventListener('click', function() {
    searchInput.value = '';
    loadAndDisplayPhotos();
});

// Function to display photos in the gallery
function displayPhotos(photosToDisplay) {
    gallery.innerHTML = '';
    
    if (photosToDisplay.length === 0) {
        gallery.innerHTML = '<p class="no-photos">No photos to display. Upload some photos to get started!</p>';
        return;
    }
    
    // Sort photos by date added (newest first)
    photosToDisplay.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    
    // Limit display to 100 at a time for performance
    const photosToShow = photosToDisplay.slice(0, 100);
    
    photosToShow.forEach(photo => {
        const photoCard = document.createElement('div');
        photoCard.className = 'photo-card';
        
        const img = document.createElement('img');
        img.src = photo.src;
        img.className = 'photo-img';
        img.alt = `Photo of ${photo.band}`;
        
        // Lazy loading for better performance
        img.loading = 'lazy';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'photo-info';
        
        const bandDiv = document.createElement('div');
        bandDiv.className = 'band-name';
        bandDiv.textContent = photo.band;
        
        const dateDiv = document.createElement('div');
        dateDiv.className = 'date';
        dateDiv.textContent = formatDate(photo.dateAdded);
        
        // Add delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'delete-button';
        deleteButton.style.backgroundColor = '#e74c3c';
        deleteButton.style.marginTop = '10px';
        
        deleteButton.addEventListener('click', function() {
            if (confirm(`Delete this photo of ${photo.band}?`)) {
                deletePhoto(photo.id);
            }
        });
        
        infoDiv.appendChild(bandDiv);
        infoDiv.appendChild(dateDiv);
        infoDiv.appendChild(deleteButton);
        
        photoCard.appendChild(img);
        photoCard.appendChild(infoDiv);
        
        gallery.appendChild(photoCard);
    });
    
    // If there are more photos than what we're showing
    if (photosToDisplay.length > 100) {
        const loadMoreDiv = document.createElement('div');
        loadMoreDiv.className = 'load-more';
        loadMoreDiv.textContent = `Showing 100 of ${photosToDisplay.length} photos. Search to narrow results or click to load more.`;
        loadMoreDiv.style.textAlign = 'center';
        loadMoreDiv.style.margin = '20px 0';
        loadMoreDiv.style.padding = '10px';
        loadMoreDiv.style.backgroundColor = '#f8f9fa';
        loadMoreDiv.style.cursor = 'pointer';
        loadMoreDiv.onclick = function() {
            // Could implement pagination here
            alert('For performance reasons, only showing 100 photos at a time. Use search to find specific band photos.');
        };
        gallery.appendChild(loadMoreDiv);
    }
}

// Function to delete a photo
function deletePhoto(photoId) {
    if (!window.indexedDB) {
        // Delete from memory if no IndexedDB
        photos = photos.filter(photo => photo.id !== photoId);
        localStorage.setItem('concertPhotos', JSON.stringify(photos));
        displayPhotos(photos);
        updateGalleryCount(photos);
        return;
    }
    
    // Delete from IndexedDB
    const request = indexedDB.open("ConcertPhotosDB", 1);
    
    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['photos'], 'readwrite');
        const objectStore = transaction.objectStore('photos');
        
        const deleteRequest = objectStore.delete(photoId);
        
        deleteRequest.onsuccess = function() {
            console.log("Photo deleted from database");
            loadAndDisplayPhotos();
        };
    };
}

// Function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Update the gallery count display
function updateGalleryCount(photosArray) {
    if (photosArray.length === 0) {
        galleryCount.textContent = 'No photos in gallery';
    } else {
        galleryCount.textContent = `Showing ${Math.min(photosArray.length, 100)} of ${photosArray.length} photo${photosArray.length !== 1 ? 's' : ''}`;
    }
}