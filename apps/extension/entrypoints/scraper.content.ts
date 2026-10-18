/**
 * Injected on demand by lib/scraper.ts (never auto-registered). Scrolls the page
 * to trigger lazy-loaded content, then returns its title and body HTML.
 */

/**
 * Walking a very long page (a 200k px changelog is ~600 steps) never finishes in
 * practice: scraped tabs are hidden, so Chrome clamps their timers to 1s and,
 * after 5 minutes, to once a minute. Lazy content near the top is what matters.
 */
const SCROLL_BUDGET_MS = 10_000;

export default defineContentScript({
  registration: "runtime",
  main() {
    // Function to scroll the page
    const scrollPage = async () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const scrollDistance = viewportHeight * 0.8; // Scroll 80% of viewport height each time
      const deadline = Date.now() + SCROLL_BUDGET_MS;
      let currentPosition = 0;

      // Scroll down the page in increments
      while (currentPosition < scrollHeight && Date.now() < deadline) {
        window.scrollTo(0, currentPosition);
        currentPosition += scrollDistance;

        // Wait for content to load (adjust delay as needed)
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Scroll to the very bottom
      window.scrollTo(0, scrollHeight);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Back to the top
      window.scrollTo(0, 0);
      await new Promise((resolve) => setTimeout(resolve, 200));
    };

    const convertPageToHTML = async () => {
      // Scroll the page first to trigger lazy-loaded content
      await scrollPage();

      // Return raw HTML and title after scrolling
      return {
        url: location.href,
        title: document.title,
        html: document.body.innerHTML,
      };
    };

    // executeScript resolves with this value
    return convertPageToHTML();
  },
});
