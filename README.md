# YAM205 Computing Systems çalışma sitesi

YAM205 Computing Systems dersi için sıfırdan anlatım, hocanın çözdüğü soruların adım adım çözümleri, etkileşimli devreler ve alıştırmalar.

Site sadece HTML, CSS ve JavaScript. Derleme gerekmez: `index.html` dosyasını tarayıcıda açmak yeterli.

## Dersler

1. Number Systems
2. Boolean Algebra
3. Logic Design
4. Karnaugh Maps
5. K-Maps with Don't Care
6. Combinational Circuits 1
7. Combinational Circuits 2

## GitHub Pages ile yayınlama

1. GitHub'da yeni, boş bir depo oluştur (README eklemeden).
2. Bu klasörde:
   ```
   git remote add origin https://github.com/KULLANICI_ADIN/DEPO_ADI.git
   git push -u origin main
   ```
3. Depoda **Settings → Pages** bölümüne git. "Source" olarak **Deploy from a branch**, branch olarak **main** ve klasör olarak **/ (root)** seç, kaydet.
4. Bir iki dakika sonra site `https://KULLANICI_ADIN.github.io/DEPO_ADI/` adresinde açılır.

Hocanın PDF'leri `.gitignore` ile dışarıda bırakıldı ve depoya yüklenmez.
