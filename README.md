# Social Media App

**🌐 Live Demo:** [https://social-media-zeta-two.vercel.app/](https://social-media-5ovjhs9rc-ahmed-ae4e.vercel.app)

A dynamic frontend application built with Vite, vanilla JavaScript, and Bootstrap 5. It integrates with a RESTful API to provide core social media features like user authentication, creating posts, viewing feeds, and interacting through comments.

## 🚀 Features

*   **User Authentication:** Secure registration, login, and logout functionality using token-based authentication.
*   **Post Management (CRUD):** Create, read, update, and delete posts. Supports image uploads along with text content.
*   **Interactive Feed:** View posts from the community with dynamic DOM rendering.
*   **Comments System:** Read and add comments to individual posts via interactive modals.
*   **Dark/Light Mode Toggle:** Built-in theme switcher that respects system preferences and saves the user's choice locally.
*   **Responsive UI:** Fully responsive design utilizing Bootstrap 5, complete with Modals, interactive buttons, and Toast notifications for user feedback.
*   **Security measures:** Custom HTML escaping to sanitize inputs and prevent XSS (Cross-Site Scripting) attacks.

## 🛠️ Tech Stack

*   **Frontend Core:** HTML5, CSS3, Vanilla JavaScript (ES6+ modules)
*   **Bundler & Tooling:** [Vite](https://vitejs.dev/)
*   **Styling & UI:** [Bootstrap 5](https://getbootstrap.com/) & Bootstrap Icons
*   **HTTP Client:** [Axios](https://axios-http.com/)
*   **API Service:** Tarmeez Academy REST API

## 🧠 What I Learned & Used

Building this project provided hands-on experience with fundamental and advanced frontend concepts:

*   **REST API Integration:** Using `Axios` to handle asynchronous GET, POST, PUT, and DELETE requests, including setting up `Bearer` tokens for authorized routes.
*   **State & Session Management:** Utilizing `localStorage` to persist authentication tokens and user profiles across browser sessions, and dynamically updating the UI based on whether a user is logged in.
*   **Dynamic DOM Manipulation:** Constructing and injecting complex HTML structures (like post cards and modals) dynamically into the DOM using vanilla JavaScript (`innerHTML` and template literals), giving the app a Single Page Application (SPA) feel.
*   **Handling File Uploads:** Leveraging the `FormData` API to properly bundle text inputs and image files (`<input type="file">`) into a single API payload.
*   **UI/UX Implementations:** Utilizing Bootstrap's utility classes and JavaScript components to create responsive navigation bars, interactive modals, loading skeletons, and real-time toast alerts.
*   **Security Best Practices:** Writing manual `escapeHTML` utility functions to sanitize incoming API strings, heavily mitigating XSS risks.

## 🏃‍♂️ How to Run Locally

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd socialmediaproject
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
4.  **Start the development server:**
    ```bash
    npm run dev
    ```
5. Open your browser and visit the local URL provided by Vite
