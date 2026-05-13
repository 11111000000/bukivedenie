// Prompts for AITUNNEL image generation used by site/scripts/generate-images-aitunnel.js
// Export an array of slide descriptors: { name, prompt, file }
module.exports = [
  {
    name: 'title-slide',
    prompt: `Conference slide background, flat vector illustration: center composition with an open book whose pages flow into stylized charts (bar, line), a small network graph and a word cloud above. Leave a clear empty area at top-left for slide title. Include subtle references to Leo Tolstoy and the novel "War and Peace" (books, quill, classical ornament) combined with modern computers and software agents (screens, nodes). Limited palette: deep navy #0b3d91, warm orange #ff7a3d, soft gray #f5f6f8. Minimalist, high legibility, vector shapes, subtle drop shadows, 16:9, 1920x1080`,
    file: 'slide-01-title.png',
  },
  {
    name: 'intro-slide',
    prompt: `Educational conference illustration, flat vector: a researcher silhouette on the left looking at a large display of charts and text snippets on the right; schematic book pages in the background with a small portrait or silhouette evoking Leo Tolstoy and a label "Война и мир". Add elements that hint at computing and software agents (small node graphs, terminals). Maintain consistent palette (navy, warm orange, soft gray). Provide clear margin for subtitle text. Clean lines, modern educational style, 16:9, 1920x1080`,
    file: 'slide-02-intro.png',
  }
]
