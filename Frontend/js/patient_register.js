import { apiPost, initHeader } from "./common.js";

document.addEventListener("DOMContentLoaded", () => {
  initHeader();

  // Helper shortcut
  const $ = (sel) => document.querySelector(sel);

  // === Collect input + error elements ===
  const prefixEl   = $("#patPrefix");
  const firstEl    = $("#patFirst");
  const middleEl   = $("#patMiddle");
  const lastEl     = $("#patLast");

  const dobEl      = $("#patDOB");
  const sexEl      = $("#patSex");

  const phoneEl    = $("#patPhone");
  const emailEl    = $("#patEmail");

  const addr1El    = $("#patAddressLine1");
  const addr2El    = $("#patAddressLine2");
  const suburbEl   = $("#patSuburb");
  const cityEl     = $("#patCity");
  const stateEl    = $("#patState");
  const postEl     = $("#patPostcode");

  const emergNameEl  = $("#patEmergencyName");
  const emergPhoneEl = $("#patEmergencyPhone");

  const notesEl      = $("#patNotes");
  const outEl        = $("#outCreate");
  const btnCreate    = $("#btnCreatePatient");

  // === Error fields ===
  const err = {
    prefix: $("#errPrefix"),
    first: $("#errFirst"),
    last: $("#errLast"),
    dob: $("#errDOB"),
    sex: $("#errSex"),
    phone: $("#errPhone"),
    email: $("#errEmail"),
    addr1: $("#errAddress1"),
    suburb: $("#errSuburb"),
    city: $("#errCity"),
    state: $("#errState"),
    post: $("#errPostcode"),
    emergName: $("#errEmergencyName"),
    emergPhone: $("#errEmergencyPhone"),
  };

  // === Validation helpers ===
  function setError(el, errField, msg) {
    errField.textContent = msg;
    el.classList.add("input-error");
  }

  function clearError(el, errField) {
    errField.textContent = "";
    el.classList.remove("input-error");
  }

  function validateName(el, errField) {
    const v = el.value.trim();
    if (v.length < 2) {
      setError(el, errField, "Please enter a valid name.");
      return false;
    }
    clearError(el, errField);
    return true;
  }

  function validateDOB() {
    const v = dobEl.value;
    if (!v) {
      setError(dobEl, err.dob, "Please enter a valid date.");
      return false;
    }

    const selected = new Date(v);
    const today = new Date();

    if (selected > today) {
      setError(dobEl, err.dob, "Please enter a valid date.");
      return false;
    }

    clearError(dobEl, err.dob);
    return true;
  }

  function validateEmail() {
    const v = emailEl.value.trim();
    const pattern = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

    if (!pattern.test(v)) {
      setError(emailEl, err.email, "Please enter a valid email.");
      return false;
    }

    clearError(emailEl, err.email);
    return true;
  }

  function validatePostcode() {
    const v = postEl.value.trim();
    if (!/^\d{4}$/.test(v)) {
      setError(postEl, err.post, "Please enter a 4-digit postcode.");
      return false;
    }
    clearError(postEl, err.post);
    return true;
  }

  function validateRequired(el, errField, msg = "This field is required.") {
    if (!el.value.trim()) {
      setError(el, errField, msg);
      return false;
    }
    clearError(el, errField);
    return true;
  }

  // === Phone formatting ===
  function formatPhoneInput(event) {
    // 'event.target' is the specific input field (phoneEl or emergPhoneEl)
    const inputEl = event.target;
    
    let digits = inputEl.value.replace(/\D/g, "").slice(0, 10);

    let formatted = "";
    if (digits.length > 0) formatted = digits.slice(0, 4);
    if (digits.length > 4) formatted += " " + digits.slice(4, 7);
    if (digits.length > 7) formatted += " " + digits.slice(7, 10);

    inputEl.value = formatted;
  }

  function validatePhone(el, errField) {
    const digits = el.value.replace(/\D/g, ""); // Remove non-digits

    if (!/^04\d{8}$/.test(digits)) {
      setError(el, errField, "Please enter a valid Australian number.");
      return false;
    }

    clearError(el, errField);
    return true;
  }

  phoneEl.addEventListener("input", formatPhoneInput);
  emergPhoneEl.addEventListener("input", formatPhoneInput);

  // === Attach blur listeners ===
  prefixEl.addEventListener("blur", () => validateRequired(prefixEl, err.prefix));
  firstEl.addEventListener("blur", () => validateName(firstEl, err.first));
  lastEl.addEventListener("blur", () => validateName(lastEl, err.last));

  dobEl.addEventListener("blur", validateDOB);
  sexEl.addEventListener("blur", () => validateRequired(sexEl, err.sex));

  phoneEl.addEventListener("blur", () => validatePhone(phoneEl, err.phone));
  emailEl.addEventListener("blur", validateEmail);

  addr1El.addEventListener("blur", () => validateRequired(addr1El, err.addr1));
  suburbEl.addEventListener("blur", () => validateRequired(suburbEl, err.suburb));
  cityEl.addEventListener("blur", () => validateRequired(cityEl, err.city));
  stateEl.addEventListener("blur", () => validateRequired(stateEl, err.state));
  postEl.addEventListener("blur", validatePostcode);

  emergNameEl.addEventListener("blur", () => validateName(emergNameEl, err.emergName));
  emergPhoneEl.addEventListener("blur", () => validatePhone(emergPhoneEl, err.emergPhone));

  // === Build address string ===
  function buildAddress() {
    const line1 = addr1El.value.trim();
    const line2 = addr2El.value.trim();
    const suburb = suburbEl.value.trim();
    const city = cityEl.value.trim();
    const state = stateEl.value.trim();
    const post = postEl.value.trim();

    if (line2) {
      return `${line2} / ${line1}, ${suburb}, ${city}, ${state}, ${post}`;
    }

    return `${line1}, ${suburb}, ${city}, ${state}, ${post}`;
  }

  // === Submit Handler ===
  btnCreate.addEventListener("click", async () => {
    outEl.innerHTML = ""; // Use innerHTML so we can style the output

    // Validate all fields
    let valid =
      validateRequired(prefixEl, err.prefix) &
      validateName(firstEl, err.first) &
      validateName(lastEl, err.last) &
      validateDOB() &
      validateRequired(sexEl, err.sex) &
      validatePhone(phoneEl, err.phone) &
      validateEmail() &
      validateRequired(addr1El, err.addr1) &
      validateRequired(suburbEl, err.suburb) &
      validateRequired(cityEl, err.city) &
      validateRequired(stateEl, err.state) &
      validatePostcode() &
      validateRequired(emergNameEl, err.emergName) &
      validatePhone(emergPhoneEl, err.emergPhone);

    if (!valid) {
      outEl.innerHTML = "❌ Please correct the errors before submitting.";
      return;
    }

    const finalAddress = buildAddress();

    try {
      const r = await apiPost("/patients", {
        prefix: prefixEl.value,
        first_name: firstEl.value.trim(),
        middle_name: middleEl.value.trim() || null,
        last_name: lastEl.value.trim(),
        date_of_birth: dobEl.value,
        sex: sexEl.value,
        phone_number: phoneEl.value.trim(),
        email: emailEl.value.trim(), // This is now used for the user account
        address: finalAddress,
        emergency_contact_name: emergNameEl.value.trim(),
        emergency_contact_phone: emergPhoneEl.value.trim(),
        notes_text: notesEl.value.trim(),
      });

      const data = await r.json();

      if (!r.ok) {
        // Use innerHTML to render error text
        outEl.innerHTML = `❌ Error: ${data.error || data.detail}`;
        return;
      }

      // Check for the email and temp_password in the successful response
      if (data.email && data.temp_password) {
        outEl.innerHTML = `
          <div class="success-message">
            <strong>✅ Patient and User Account created!</strong>
            <p>Please give these login details to the patient:</p>
            <div class="login-details-box">
              <strong>Email:</strong> ${data.email}<br>
              <strong>Password:</strong> <span class="temp-password">${data.temp_password}</span>
            </div>
          </div>
        `;
        
        // Clear form after success
        prefixEl.value = "";
        firstEl.value = "";
        middleEl.value = "";
        lastEl.value = "";
        dobEl.value = "";
        sexEl.value = "";
        phoneEl.value = "";
        emailEl.value = "";
        addr1El.value = "";
        addr2El.value = "";
        suburbEl.value = "";
        cityEl.value = "";
        stateEl.value = "";
        postEl.value = "";
        emergNameEl.value = "";
        emergPhoneEl.value = "";
        notesEl.value = "";
        
      } else {
        // Fallback if something went wrong but didn't error
        outEl.innerHTML = "✅ Patient created, but user details were not returned.";
      }

    } catch (err) {
      outEl.innerHTML = "❌ A network error occurred. Please try again.";
      console.error('Create patient error:', err);
    }
  });
});