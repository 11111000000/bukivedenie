Simple project structure after archival (kept only what is needed for MVP):

- src/                # main code (extractor, webapp, analyze_text) — core for running analysis and web UI
  - extractor/        # NER heuristic, metrics, IO, cooccur
  - preprocessing/    # normalization, tokenization, lemmatization
  - webapp.py
  - analyze_text.py
- data/
  - raw/              # input .txt files (keep originals)
- configs/            # stopwords, pipeline.yml
- outputs/            # analysis outputs for active books (keep needed books only)
- scripts/            # small helper scripts
- tests/              # unit tests
- web_view/           # frontend index.html
- phots/              # task notes (keep)
- logs/               # webapp.log (rotated/clean as needed)
- STRUCTURE.md        # this file
- archives stored at: ~/storage/shared/Documents/bukivedenie_archives

The following were archived to '~/storage/shared/Documents/bukivedenie_archives':
- src/ml/ (models and training) -> bukivedenie_src_ml.tgz
- frequency_dictionary.csv files -> bukivedenie_frequency_dictionary_files.tgz
- data/processed/ -> bukivedenie_data_processed.tgz
- __pycache__ and .pyc -> bukivedenie_pycache_pyc.tgz
- embeddings source/weights -> bukivedenie_embeddings.tgz

If you want, I can remove additional large outputs or move selected outputs to the archive.
