let docsData = [];

    // Fetch docs.json on page load
    fetch("/docs/docs.json")
        .then(res => res.json())
        .then(data => docsData = data)
        .catch(err => console.error("Failed to load docs.json:", err));

    const input = document.getElementById("docsSearchInput");
    const resultsBox = document.getElementById("docsSearchResults");

    input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();

        if (q.length === 0) {
            resultsBox.classList.add("hidden");
            resultsBox.innerHTML = "";
            return;
        }

        const matches = docsData.filter(item =>
            item.title.toLowerCase().includes(q) ||
            (item.description && item.description.toLowerCase().includes(q))
        );

        if (matches.length === 0) {
            resultsBox.innerHTML = `
                <div class="p-4 text-sm text-gray-500">No results found.</div>
            `;
            resultsBox.classList.remove("hidden");
            return;
        }

        resultsBox.innerHTML = matches
            .map(item => `
                <a href="${item.link}"
                   class="block p-4 border-b last:border-b-0 border-gray-100 hover:bg-gray-50 transition rounded-lg">
                    <div class="font-semibold text-gray-900">${item.title}</div>
                    <div class="text-sm text-gray-600">${item.description || ""}</div>
                </a>
            `)
            .join("");

        resultsBox.classList.remove("hidden");
    });

    // Click-away close
    document.addEventListener("click", (e) => {
        if (!resultsBox.contains(e.target) && e.target !== input) {
            resultsBox.classList.add("hidden");
        }
    });
