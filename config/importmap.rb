# Pin npm packages by running ./bin/importmap

pin "application"
# Turbo Streams enabled for server-driven sorting (Turbo Drive remains disabled)
pin "@hotwired/turbo-rails", to: "@hotwired--turbo-rails.js" # @8.0.16
pin "@hotwired/turbo", to: "@hotwired--turbo.js" # @8.0.13
pin "@rails/actioncable/src", to: "@rails--actioncable--src.js" # @8.0.200
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"
pin_all_from "app/javascript/bos", under: "bos"

# Sortable.js
pin "sortable.min", to: "sortable.min.js"
pin "sortablejs", to: "sortable-wrapper.js"
pin "html2canvas", to: "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js"
