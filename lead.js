/* Sends form submissions to the band's inbox through Web3Forms.
   The access key is public by design (it can only deliver mail to the address
   it was created for). Resolves true on success, false on any failure. */
(function () {
  var ACCESS_KEY = '23a031c6-33dd-492b-b7b6-a2510d1ec50b';

  window.sendLead = function (subject, fields) {
    var body = Object.assign({
      access_key: ACCESS_KEY,
      subject: subject,
      from_name: 'NAMANMUSICA website',
      page: location.href
    }, fields);

    return fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var ok = !!(j && j.success);
        if (ok && window.fbq) window.fbq('track', 'Lead');
        return ok;
      })
      .catch(function () { return false; });
  };
})();
