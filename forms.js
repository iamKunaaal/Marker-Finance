/* =====================================================================
 * Marker Finance — Form handlers
 * Routes Contact / Product / Careers submissions to Google Apps Script
 * which appends rows to the Marker Finance Leads workbook.
 * ===================================================================== */

const FORMS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz9cYb9CO23DgV9kqFapOMXrRYZi5Jypa6uQEkvUNqqIYQiFMOS-Y73rpwqCCetQXRYFQ/exec';

async function mfPost(payload) {
  // Use text/plain so the request doesn't trigger a CORS preflight.
  // Apps Script reads e.postData.contents regardless of content type.
  const res = await fetch(FORMS_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  return res.json();
}

function mfReadFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function mfSetLoading(form, loading) {
  const btn = form.querySelector('button[type="submit"]');
  if (!btn) return;
  const span = btn.querySelector('span');
  if (loading) {
    if (!btn.dataset.originalText) btn.dataset.originalText = span ? span.textContent : btn.textContent;
    if (span) span.textContent = 'Sending…'; else btn.textContent = 'Sending…';
    btn.disabled = true;
  } else {
    if (btn.dataset.originalText) {
      if (span) span.textContent = btn.dataset.originalText; else btn.textContent = btn.dataset.originalText;
    }
    btn.disabled = false;
  }
}

function mfShowError(form) {
  alert('Could not send right now. Please try again or contact us directly on WhatsApp.');
}

// -------- Contact form (contact.html) --------
document.querySelectorAll('form.ct-form').forEach((form) => {
  form.removeAttribute('onsubmit');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mfSetLoading(form, true);
    try {
      const r = await mfPost({
        formType: 'contact',
        name: form.querySelector('#ctName')?.value || '',
        company: form.querySelector('#ctCompany')?.value || '',
        phone: form.querySelector('#ctPhone')?.value || '',
        email: form.querySelector('#ctEmail')?.value || '',
        service: form.querySelector('#ctService')?.value || '',
        message: form.querySelector('#ctMessage')?.value || ''
      });
      if (!r.ok) throw new Error(r.error || 'Server error');
      document.getElementById('ctSuccess')?.classList.add('show');
      form.reset();
    } catch (err) {
      console.error(err);
      mfShowError(form);
    } finally {
      mfSetLoading(form, false);
    }
  });
});

// -------- Product page form (12 product pages) --------
document.querySelectorAll('form.pd-form').forEach((form) => {
  form.removeAttribute('onsubmit');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mfSetLoading(form, true);
    try {
      const productPage = (document.title.split(' · ')[0] || document.title).trim();
      const r = await mfPost({
        formType: 'product',
        productPage,
        name: form.querySelector('#pdName')?.value || '',
        phone: form.querySelector('#pdPhone')?.value || '',
        email: form.querySelector('#pdEmail')?.value || '',
        service: form.querySelector('#pdService')?.value || '',
        subject: form.querySelector('#pdSubject')?.value || '',
        message: form.querySelector('#pdMessage')?.value || ''
      });
      if (!r.ok) throw new Error(r.error || 'Server error');
      document.getElementById('pdSuccess')?.classList.add('show');
      form.reset();
    } catch (err) {
      console.error(err);
      mfShowError(form);
    } finally {
      mfSetLoading(form, false);
    }
  });
});

// -------- Careers form (careers.html) --------
document.querySelectorAll('form.cr-form').forEach((form) => {
  form.removeAttribute('onsubmit');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mfSetLoading(form, true);
    try {
      const fileInput = form.querySelector('#crResume');
      const file = fileInput?.files?.[0];
      let resumeFields = {};
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          alert('Resume file is over 10 MB. Please upload a smaller file.');
          mfSetLoading(form, false);
          return;
        }
        resumeFields = {
          resumeBase64: await mfReadFileBase64(file),
          resumeName: file.name,
          resumeType: file.type || 'application/pdf'
        };
      }
      const r = await mfPost({
        formType: 'career',
        position: form.querySelector('#crPosition')?.value || '',
        firstName: form.querySelector('#crFirstName')?.value || '',
        lastName: form.querySelector('#crLastName')?.value || '',
        phone: form.querySelector('#crPhone')?.value || '',
        email: form.querySelector('#crEmail')?.value || '',
        dob: form.querySelector('#crDob')?.value || '',
        nationality: form.querySelector('#crNationality')?.value || '',
        coverLetter: form.querySelector('#crCover')?.value || '',
        ...resumeFields
      });
      if (!r.ok) throw new Error(r.error || 'Server error');
      document.getElementById('crSuccess')?.classList.add('show');
      form.reset();
      const nameEl = document.getElementById('crFileName');
      if (nameEl) nameEl.textContent = 'No file chosen';
    } catch (err) {
      console.error(err);
      mfShowError(form);
    } finally {
      mfSetLoading(form, false);
    }
  });
});
