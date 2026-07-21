/**
 * Full Outpay Terms of Service draft supplied for publication review.
 *
 * Exports the legal copy rendered by the Terms of Service page. The document
 * intentionally retains counsel-review placeholders from the supplied draft.
 */

export const TERMS_OF_SERVICE_MARKDOWN = `
# Outpay Terms of Service

**Last updated: July 20, 2026**

## Important legal notice

These Terms of Service are a comprehensive working draft prepared for review and approval by qualified legal counsel. They must not be treated as a substitute for legal advice.

Before publication, all bracketed information must be completed, and counsel must confirm that these Terms accurately reflect Outpay’s technical architecture, pricing, supported jurisdictions, regulatory obligations, privacy practices, and business model.

## 1. About Outpay and these Terms

Outpay is a product operated and listed under **Adelecte**, registered in **Tamil Nadu, India** (“**Adelecte**,” “**Outpay**,” “**we**,” “**us**,” or “**our**”).

Outpay provides non-custodial software that allows businesses to create cryptocurrency checkout sessions, display payment instructions, detect supported blockchain transactions, verify payment conditions, and receive payment-status notifications.

These Terms govern access to and use of:

* the Outpay website;
* merchant accounts and dashboards;
* hosted checkout pages;
* checkout links;
* application programming interfaces;
* software development kits;
* webhooks;
* documentation;
* integrations;
* developer tools; and
* any other services, applications, features, or functionality provided by Outpay,

collectively, the “**Services**.”

These Terms apply to:

1. businesses and individuals creating or managing an Outpay account (“**Merchants**”);
2. Merchant employees, contractors, representatives, and authorized users;
3. customers or other persons using an Outpay checkout to make a payment (“**Payers**”); and
4. any person accessing or using the Services.

A Merchant and a Payer may each be referred to as “**you**.”

## 2. Acceptance of these Terms

By creating an account, clicking an acceptance button, accessing the dashboard, generating a checkout, using an Outpay API or integration, submitting a blockchain transaction through an Outpay checkout, or otherwise accessing or using the Services, you:

* confirm that you have read and understood these Terms;
* agree to be legally bound by these Terms;
* agree to our Privacy Policy, Prohibited Businesses Policy, Acceptable Use Policy, pricing terms, API documentation, and other policies incorporated by reference; and
* consent to entering into this agreement electronically.

If you use the Services for a company, organization, partnership, sole proprietorship, or other entity, you represent that you have authority to bind that entity. In that case, “you” includes both you and that entity.

If you do not agree to these Terms, you must not access or use the Services.

## 3. Eligibility

You may use the Services only if:

* you are at least eighteen years old or have reached the legal age of majority in your jurisdiction;
* you are legally capable of entering into a binding contract;
* you are not prohibited from using the Services under applicable law;
* you are not located in, ordinarily resident in, organized under the laws of, or operating from a prohibited or comprehensively sanctioned jurisdiction;
* you are not subject to applicable sanctions or appearing on a relevant restricted-party list;
* your use of the Services has not previously been suspended or terminated by Outpay; and
* all information you provide is truthful, accurate, current, and complete.

Merchant accounts are intended primarily for business, commercial, or professional use. You must not misrepresent personal activity as business activity or create an account for another person without authorization.

## 4. Outpay’s limited role

Outpay is a technology provider. Unless expressly stated in a separate written agreement, Outpay is not:

* the seller or supplier of any Merchant’s goods or services;
* the Merchant of Record;
* a party to any transaction between a Merchant and Payer;
* an agent, partner, joint venturer, employee, or representative of a Merchant or Payer;
* a bank, deposit-taking institution, credit union, lender, broker, exchange, investment adviser, fiduciary, trustee, or insurer;
* an escrow provider;
* a wallet provider;
* a custodian of digital assets;
* a guarantor of any payment;
* a guarantor of any Merchant, Payer, product, service, blockchain, token, wallet, or transaction; or
* a dispute-resolution provider for disputes between Merchants and Payers.

Outpay does not determine whether a Merchant has delivered goods or services, whether those goods or services conform to their description, or whether a Payer is entitled to a cancellation, refund, replacement, or other remedy.

The Merchant—not Outpay—is solely responsible for its commercial relationship with each Payer.

## 5. Non-custodial payment model

Outpay currently operates as a non-custodial checkout and blockchain-payment verification service.

Supported digital assets are transferred directly from a Payer-controlled wallet to a Merchant-designated wallet. Outpay does not ordinarily:

* possess or control the Merchant’s or Payer’s private keys;
* hold digital assets on behalf of either party;
* take legal or beneficial ownership of payment funds;
* pool customer or Merchant funds;
* maintain stored-value balances;
* reverse blockchain transactions;
* recover private keys or seed phrases;
* convert digital assets into fiat currency;
* guarantee settlement or redemption; or
* protect a Merchant or Payer against loss of funds.

A Merchant is solely responsible for selecting, controlling, securing, and maintaining its receiving wallet.

A Payer is solely responsible for controlling and securing the wallet used to initiate payment.

Outpay will never require a wallet seed phrase or private key. Anyone requesting such information while claiming to represent Outpay should be treated as potentially fraudulent.

## 6. Merchant accounts

Merchants may be required to create an account to access certain Services.

You must:

* provide accurate registration and business information;
* keep your contact, ownership, tax, support, and wallet information current;
* use strong and unique authentication credentials;
* enable available security protections;
* restrict account access to authorized personnel;
* promptly remove former employees and unauthorized users;
* keep API keys, webhook secrets, authentication tokens, and credentials confidential;
* monitor account activity for unauthorized access; and
* promptly notify Outpay of suspected compromise or misuse.

You are responsible for all actions performed through your account, including actions by team members, contractors, applications, integrations, or persons using your credentials.

Outpay may treat instructions received through your authenticated account or API credentials as authorized instructions.

Outpay is not responsible for losses caused by compromised credentials, shared credentials, insecure devices, malicious browser extensions, phishing, social engineering, malware, unauthorized team members, or failure to follow reasonable security practices.

## 7. Merchant responsibilities

Each Merchant is solely responsible for:

* its products, services, subscriptions, donations, fundraising activity, or other transactions;
* product descriptions, prices, taxes, shipping, delivery, and fulfilment;
* customer disclosures and representations;
* checkout amounts and currency calculations;
* selecting the correct wallet, network, token, and token contract;
* wallet ownership, custody, access, and security;
* displaying legally required business and contact information;
* maintaining appropriate terms of sale, refund policies, privacy notices, and customer-support procedures;
* determining when an order should be accepted, rejected, fulfilled, cancelled, or refunded;
* handling partial, duplicate, late, excessive, deficient, or misdirected payments;
* complying with applicable tax, accounting, record-keeping, invoicing, consumer-protection, licensing, advertising, sanctions, anti-money-laundering, anti-bribery, export-control, and privacy laws;
* obtaining all required registrations, permits, licences, approvals, and professional advice;
* ensuring that its employees, contractors, agents, and users comply with these Terms; and
* maintaining appropriate insurance for its business activities.

A Merchant must not represent that Outpay:

* endorses the Merchant;
* guarantees the Merchant;
* has reviewed or approved the Merchant’s products;
* guarantees that a payment is lawful or non-fraudulent;
* guarantees blockchain finality;
* provides insurance or buyer protection; or
* is responsible for the Merchant’s refund or fulfilment obligations.

## 8. Merchant–Payer transactions

Any purchase, subscription, donation, invoice, or other underlying transaction is directly between the Merchant and the Payer.

The Merchant is solely responsible for:

* the legality and enforceability of the underlying transaction;
* providing accurate payment and product information;
* obtaining Payer consent;
* fulfilling the transaction;
* issuing receipts or invoices;
* addressing complaints;
* providing refunds;
* complying with warranties and consumer rights;
* responding to regulatory authorities; and
* resolving disputes.

Outpay has no obligation to intervene in a Merchant–Payer dispute.

A Payer must review the Merchant’s identity, product terms, wallet information, refund policy, and transaction details before making payment.

## 9. Checkout sessions

A checkout session may contain:

* a payment amount;
* a supported asset;
* a supported blockchain network;
* a destination wallet address;
* an expiration time;
* a payment reference;
* Merchant-supplied descriptions or metadata; and
* other payment conditions.

A checkout session is not a guarantee that:

* the Merchant is legitimate;
* the underlying product is available;
* the Merchant will fulfil the transaction;
* the displayed exchange value will remain constant;
* the blockchain transaction will succeed;
* the payment will be detected;
* the transaction will achieve finality;
* the token will retain its value; or
* the Merchant will issue a refund.

Merchants must verify checkout configuration before making it available to Payers.

Payers must independently verify payment details in their wallet before authorizing a transaction.

## 10. Supported assets and networks

Outpay supports only the digital assets, blockchain networks, token contracts, wallet formats, and transaction types expressly identified as supported in the applicable checkout or documentation.

An asset with the same or a similar name, ticker, logo, or symbol is not necessarily a supported asset.

Payments may not be recognized if they are:

* sent using an unsupported network;
* sent using an unsupported token contract;
* bridged or wrapped versions of a supported asset;
* sent to an incorrect address;
* sent after checkout expiry;
* sent in an incorrect amount;
* sent through an unsupported smart-contract method;
* sent using privacy-enhancing or obfuscation technology;
* subject to a token freeze, blacklist, pause, or clawback;
* associated with a restricted wallet; or
* otherwise inconsistent with the checkout instructions.

Outpay may add, remove, suspend, or modify support for any asset or network at any time.

## 11. Blockchain transaction risks

By using the Services, you acknowledge that blockchain transactions involve significant technical, operational, legal, and financial risks, including:

* irreversible transactions;
* inaccurate wallet addresses;
* incorrect networks;
* smart-contract defects;
* blockchain forks;
* chain reorganizations;
* delayed block production;
* validator or sequencer failures;
* network congestion;
* failed or dropped transactions;
* changing gas fees;
* front-end or wallet display errors;
* malicious tokens;
* compromised wallets;
* phishing;
* replay attacks;
* protocol governance changes;
* bridge failures;
* oracle failures;
* RPC provider failures;
* indexing delays;
* cybersecurity incidents;
* government restrictions;
* token issuer freezes or blacklisting;
* stablecoin depegging;
* issuer insolvency;
* redemption restrictions;
* liquidity shortages;
* contract upgrades;
* unsupported token migrations; and
* permanent loss of digital assets.

You accept these risks and are solely responsible for determining whether a blockchain transaction is suitable for you.

## 12. Stablecoin risks

A stablecoin’s name, intended peg, historical performance, or issuer representations do not guarantee that it will maintain a particular value.

Outpay does not guarantee:

* the solvency of a stablecoin issuer;
* the existence or adequacy of reserves;
* redemption availability;
* redemption value;
* regulatory treatment;
* continued token support;
* liquidity;
* transferability;
* protection from freezes or blacklisting; or
* continued parity with any fiat currency.

A Merchant bears the risk that a supported asset changes in value before, during, or after payment.

## 13. Payment detection and status

Outpay may use blockchain nodes, RPC providers, webhook providers, indexers, internal databases, third-party services, and other technical systems to detect transactions.

Payment statuses are technical and informational indicators only. They do not constitute:

* a legal determination that a debt has been discharged;
* a guarantee of blockchain finality;
* a guarantee that funds are spendable;
* confirmation that a transaction is lawful;
* confirmation that a Merchant must fulfil an order;
* financial, accounting, tax, or legal advice; or
* a warranty that no reorganization, freeze, reversal mechanism, or protocol event will affect the transaction.

Payment detection may be delayed, incomplete, duplicated, inaccurate, or unavailable.

Merchants must independently confirm material or high-value transactions before delivering irreversible goods or services.

## 14. Confirmations and blockchain finality

Outpay may apply confirmation thresholds or other internal criteria before marking a transaction as paid or confirmed.

These criteria may vary based on:

* network conditions;
* transaction value;
* asset type;
* fraud signals;
* chain stability;
* provider availability;
* protocol characteristics; and
* Outpay’s risk controls.

A transaction marked “paid,” “confirmed,” “completed,” or similar may still be affected by a blockchain reorganization, protocol failure, issuer action, or other event outside Outpay’s control.

Outpay may revise a payment status if later information indicates that the original status was inaccurate or no longer reliable.

## 15. Incorrect, partial, late, and duplicate payments

Outpay does not guarantee automatic resolution of:

* underpayments;
* overpayments;
* duplicate payments;
* payments after expiration;
* payments in the wrong asset;
* payments on the wrong network;
* payments to an incorrect address;
* payments missing required metadata;
* payments sent through an unsupported method; or
* payments affected by token transfer fees or other deductions.

The Merchant is responsible for deciding how these situations will be handled.

Outpay is not required to recover, redirect, return, reconcile, or compensate for an incorrect payment.

## 16. Refunds

Because Outpay does not custody Merchant funds, Outpay generally cannot issue, compel, cancel, reverse, or guarantee a refund.

Refunds must ordinarily be sent by the Merchant from a wallet controlled by the Merchant.

The Merchant is solely responsible for:

* determining refund eligibility;
* verifying the recipient address and network;
* calculating the refund amount;
* paying applicable network fees;
* complying with consumer and tax laws;
* maintaining refund records; and
* communicating with the Payer.

A refunded asset may have a different fiat value from the original payment. Neither party is entitled to compensation from Outpay for price changes, network fees, or exchange-rate differences.

## 17. Fees and billing

Use of the Services may be subject to transaction fees, subscription fees, usage fees, minimum fees, implementation fees, or other charges described on the pricing page, checkout, order form, dashboard, or separate agreement.

Unless otherwise stated:

* fees are exclusive of applicable taxes;
* fees are non-refundable;
* blockchain gas fees are separate from Outpay fees;
* third-party wallet, exchange, banking, or provider fees are not controlled by Outpay;
* promotional pricing may be changed or withdrawn;
* quoted fees may be corrected if displayed in error; and
* unpaid amounts may result in suspension or termination.

You authorize Outpay and its billing providers to charge the payment method associated with your account for applicable fees.

You are responsible for taxes, duties, levies, withholdings, and government charges associated with your use of the Services, excluding taxes imposed on Adelecte’s net income.

## 18. Taxes and accounting

Outpay does not provide legal, tax, accounting, investment, financial, or regulatory advice.

Digital-asset payments may create tax, accounting, reporting, valuation, or record-keeping obligations.

Merchants and Payers are responsible for:

* obtaining independent professional advice;
* calculating applicable taxes;
* determining the relevant transaction value;
* issuing legally required invoices and receipts;
* retaining records; and
* filing required reports or returns.

Outpay-generated records are provided for convenience and may not satisfy legal, accounting, or tax requirements.

## 19. Compliance reviews, KYB, KYC, and monitoring

Outpay may, where reasonably necessary or legally required:

* verify a Merchant’s identity or business;
* request ownership and control information;
* request source-of-funds or source-of-wealth information;
* request business licences, incorporation documents, tax records, policies, invoices, fulfilment records, or customer information;
* screen users and wallet addresses against sanctions and risk databases;
* assess blockchain transaction history;
* conduct fraud, sanctions, or abuse monitoring;
* restrict specific wallets, assets, networks, jurisdictions, or transactions;
* require enhanced due diligence;
* delay or restrict access to the Services;
* preserve relevant records;
* respond to valid legal process; or
* submit reports or disclosures to competent authorities where required.

You must provide requested information accurately and promptly.

Outpay may suspend or terminate access if information is incomplete, inconsistent, misleading, unverifiable, or presents unacceptable legal, regulatory, sanctions, fraud, reputational, or security risk.

Outpay is not required to disclose confidential risk models, screening criteria, legal requests, investigation methods, or the reason for a restriction where disclosure is prohibited or could undermine security or compliance controls.

## 20. Sanctions and export controls

You represent and warrant that neither you nor, where applicable, your beneficial owners, directors, managers, employees, agents, customers, counterparties, or controlled wallets are:

* subject to applicable sanctions;
* owned or controlled by a sanctioned person;
* located in a prohibited jurisdiction;
* using the Services for sanctions evasion;
* acting on behalf of a prohibited person; or
* involved in transactions prohibited by applicable export-control or trade laws.

You must not use VPNs, proxies, intermediaries, shell entities, wallet-hopping, mixers, obfuscation services, or other methods to circumvent geographic, sanctions, compliance, or risk restrictions.

Outpay may block or restrict access without prior notice where necessary to address sanctions, export-control, security, or legal risk.

## 21. Prohibited activities and businesses

You must not use the Services in connection with activity that is illegal, fraudulent, deceptive, abusive, harmful, or prohibited by an Outpay policy.

Prohibited activity includes, without limitation:

* fraud, scams, impersonation, or deceptive conduct;
* money laundering or terrorist financing;
* sanctions or export-control evasion;
* ransomware, extortion, or blackmail;
* trafficking or exploitation;
* child sexual abuse or exploitation material;
* stolen goods or stolen financial information;
* malware, spyware, credential theft, or unauthorized access;
* phishing or social engineering;
* unlicensed financial, investment, exchange, remittance, lending, securities, or gambling activity;
* pyramid schemes, Ponzi schemes, or deceptive investment programs;
* counterfeit goods;
* intellectual-property infringement;
* unlawful weapons, drugs, controlled substances, or hazardous materials;
* mixers, tumblers, or services primarily intended to obscure the source or destination of digital assets;
* evasion of taxes, court orders, regulatory controls, or law-enforcement restrictions;
* privacy violations, doxxing, stalking, or surveillance;
* misleading charities, donations, or fundraising;
* transactions involving sanctioned or stolen digital assets;
* activity that creates unreasonable fraud, dispute, regulatory, or reputational risk; or
* any attempt to help another person engage in prohibited activity.

Certain industries may be restricted or require prior written approval even when not unlawful.

The Prohibited Businesses Policy forms part of these Terms and may contain additional restrictions.

## 22. Merchant content and customer information

Merchants may submit names, logos, product descriptions, pricing, images, metadata, customer references, support details, and other content (“**Merchant Content**”).

You retain ownership of your Merchant Content.

You grant Outpay a worldwide, non-exclusive, royalty-free licence to host, reproduce, process, transmit, display, modify for technical formatting, and otherwise use Merchant Content as necessary to:

* provide the Services;
* display checkout pages;
* prevent fraud and abuse;
* comply with law;
* provide support; and
* protect Outpay, Merchants, Payers, and third parties.

You represent that you have all rights and permissions required to provide Merchant Content.

You must not place passwords, private keys, seed phrases, government identification numbers, payment-card data, health information, biometric information, or unnecessary sensitive personal information in checkout metadata or API fields.

## 23. Privacy and blockchain transparency

Our collection and use of personal information is described in the Outpay Privacy Policy.

Blockchain networks are generally public. Wallet addresses, transaction amounts, token contracts, transaction hashes, timestamps, and other blockchain data may be permanently visible to the public.

Blockchain data may allow third parties to associate transactions, wallets, identities, and commercial activity.

Outpay cannot erase, modify, or restrict public blockchain records.

Merchants are independently responsible for providing legally required privacy notices and establishing a lawful basis for collecting and processing customer information.

## 24. APIs, developer tools, and integrations

Outpay may provide APIs, SDKs, documentation, webhooks, test environments, and integration tools.

You must:

* follow the current documentation;
* secure API keys and webhook secrets;
* verify webhook signatures;
* implement idempotency and duplicate-event handling;
* validate payment details server-side;
* implement reasonable retry and failure handling;
* respect rate limits;
* avoid excessive or abusive requests;
* maintain appropriate logs and security controls; and
* promptly install security-critical updates.

You must not:

* reverse engineer non-public components;
* bypass authentication or rate limits;
* probe or exploit vulnerabilities;
* interfere with availability;
* access another user’s data;
* use the Services to distribute malware;
* resell access without authorization;
* misrepresent API responses;
* use test credentials in production; or
* use the Services in a manner that creates excessive technical or security risk.

Outpay may rotate credentials, modify endpoints, impose limits, deprecate versions, or suspend integrations.

## 25. Webhooks and notifications

Webhooks, emails, dashboard updates, and other notifications may be delayed, duplicated, delivered out of order, blocked, or not delivered.

Merchants must not rely exclusively on a single notification channel for critical decisions.

Merchants are responsible for:

* verifying webhook authenticity;
* processing events idempotently;
* securing webhook endpoints;
* preventing replay attacks;
* handling retries and duplicate events; and
* independently querying payment status when appropriate.

Outpay is not liable for fulfilment errors caused by a Merchant’s webhook, integration, automation, or business logic.

## 26. Third-party services

The Services may depend on or link to third-party products, including:

* blockchain networks;
* wallet providers;
* stablecoin issuers;
* RPC providers;
* node operators;
* cloud-hosting providers;
* analytics providers;
* authentication providers;
* email providers;
* domain-name providers;
* internet-service providers;
* exchanges;
* bridges;
* price-data providers; and
* open-source software.

Outpay does not control and is not responsible for third-party services.

Third-party services may change, fail, discontinue functionality, impose restrictions, experience security incidents, or provide inaccurate data.

Your use of a third-party service may be governed by separate terms.

## 27. Availability and service changes

The Services are provided on an “as available” basis.

Outpay does not guarantee:

* uninterrupted availability;
* error-free operation;
* any specific uptime;
* delivery of notifications;
* compatibility with every wallet or device;
* preservation of every record;
* correction of every defect;
* continued support for any feature;
* continued availability in any jurisdiction; or
* that the Services will meet your requirements.

Outpay may perform maintenance, modify functionality, impose limits, suspend features, discontinue services, or change technical requirements.

No service-level agreement applies unless expressly included in a separate written agreement signed by Adelecte.

## 28. Beta and experimental features

Features labelled beta, preview, experimental, test, early access, development, or similar may be incomplete, unstable, inaccurate, or discontinued without notice.

You use such features at your own risk.

Beta features must not be used for high-risk, safety-critical, legally regulated, or production-critical activity unless expressly approved in writing.

## 29. Security

Outpay may implement reasonable technical and organizational safeguards, but no system is completely secure.

Outpay does not guarantee that:

* unauthorized access will never occur;
* malicious software will always be detected;
* data will never be lost;
* credentials will never be compromised;
* blockchain addresses are safe;
* providers are secure; or
* security controls will prevent every attack.

You are responsible for maintaining your own backups, incident-response procedures, wallet security, authentication security, access controls, and business-continuity plans.

You must promptly report suspected security vulnerabilities to **[legal@outpay.tech](mailto:legal@outpay.tech)** and must not publicly disclose a vulnerability before Outpay has had a reasonable opportunity to investigate and remediate it.

## 30. Records and audits

Outpay may maintain service logs, transaction observations, checkout records, API records, webhook records, authentication records, compliance records, and other operational information.

Such records may be incomplete or affected by technical limitations.

Outpay may request reasonable records from a Merchant to investigate:

* fraud;
* complaints;
* sanctions concerns;
* prohibited activity;
* security incidents;
* legal requests;
* payment discrepancies; or
* compliance with these Terms.

Merchants must maintain records sufficient to demonstrate the legality and fulfilment of their transactions.

## 31. Intellectual property

The Services, including software, designs, interfaces, documentation, trademarks, logos, databases, text, graphics, and other materials, are owned by Adelecte or its licensors and are protected by applicable intellectual-property laws.

Subject to these Terms, Outpay grants you a limited, revocable, non-exclusive, non-transferable, non-sublicensable licence to access and use the Services for their intended purpose.

You must not:

* copy or redistribute the Services except as permitted;
* remove proprietary notices;
* use Outpay branding without authorization;
* create confusingly similar products or branding;
* scrape or systematically extract non-public data;
* sell, lease, or sublicense access;
* use the Services to compete through unauthorized copying; or
* claim ownership of Outpay technology.

All rights not expressly granted are reserved.

## 32. Feedback

If you provide suggestions, ideas, feature requests, or other feedback, you grant Adelecte a worldwide, perpetual, irrevocable, royalty-free, transferable, and sublicensable right to use and commercialize that feedback without restriction or compensation.

## 33. Suspension and termination

Outpay may restrict, suspend, or terminate your access immediately where reasonably necessary because of:

* breach of these Terms;
* suspected fraud or prohibited activity;
* sanctions or regulatory risk;
* inaccurate or unverifiable information;
* security concerns;
* misuse of APIs or infrastructure;
* unpaid fees;
* excessive disputes or complaints;
* risk to Outpay, its providers, Merchants, Payers, or third parties;
* a legal or governmental request;
* discontinuation of the Services; or
* activity that Outpay reasonably considers harmful.

Where practicable and legally permitted, Outpay may provide notice and an opportunity to remedy a breach. Outpay is not required to provide advance notice in urgent, security-sensitive, sanctions-related, fraudulent, or legally restricted situations.

You may stop using the Services at any time and may request account closure through the available account controls or support channels.

Termination does not:

* reverse completed blockchain transactions;
* eliminate outstanding payment obligations;
* require Outpay to delete information it must retain;
* prevent Outpay from investigating prior conduct; or
* affect provisions intended to survive termination.

## 34. Disclaimer of warranties

To the maximum extent permitted by applicable law, the Services are provided **“as is,” “as available,” and “with all faults.”**

Adelecte disclaims all express, implied, statutory, and other warranties, including warranties of:

* merchantability;
* fitness for a particular purpose;
* title;
* non-infringement;
* accuracy;
* availability;
* security;
* reliability;
* compatibility;
* quiet enjoyment;
* satisfactory quality; and
* results arising from course of dealing or usage of trade.

Adelecte does not warrant that:

* a transaction will be detected or confirmed;
* blockchain data will be accurate;
* a checkout will result in payment;
* a Payer will send the correct amount;
* a Merchant will fulfil an order;
* a wallet or provider will remain available;
* a token will retain value;
* a payment will be lawful or non-fraudulent;
* the Services will satisfy regulatory requirements;
* errors will be corrected; or
* data will be preserved without loss.

No oral or written statement creates a warranty unless expressly included in a written agreement signed by Adelecte.

## 35. Assumption of risk

You knowingly and voluntarily assume all risks associated with:

* digital assets;
* blockchain transactions;
* wallet use;
* stablecoins;
* smart contracts;
* irreversible payments;
* private-key management;
* regulatory change;
* tax treatment;
* market volatility;
* Merchant or Payer misconduct;
* unsupported transactions;
* internet and provider failures; and
* reliance on payment-status information.

You are responsible for evaluating these risks and obtaining independent legal, tax, financial, accounting, cybersecurity, and technical advice.

## 36. Release

To the maximum extent permitted by applicable law, you release Adelecte and its proprietor, affiliates, employees, contractors, representatives, licensors, and service providers from claims arising from:

* disputes between Merchants and Payers;
* Merchant products or services;
* non-delivery or defective delivery;
* refunds;
* incorrect wallet addresses;
* wrong-network transactions;
* lost private keys;
* compromised wallets;
* price volatility;
* stablecoin depegging;
* issuer freezes or blacklisting;
* blockchain reorganizations;
* third-party services;
* fraud committed by another user; or
* transactions initiated or authorized through your credentials.

This release does not apply where prohibited by law.

## 37. Indemnification

To the maximum extent permitted by law, each Merchant agrees to defend, indemnify, and hold harmless Adelecte and its proprietor, affiliates, employees, contractors, representatives, licensors, and service providers from claims, proceedings, investigations, losses, liabilities, damages, penalties, fines, judgments, settlements, costs, and reasonable legal fees arising from or relating to:

* the Merchant’s goods, services, business, or underlying transactions;
* breach of these Terms;
* Merchant Content;
* infringement of third-party rights;
* fraud, negligence, misconduct, or unlawful activity;
* violation of sanctions, tax, consumer, privacy, advertising, licensing, or other laws;
* customer complaints, refunds, cancellations, fulfilment, or disputes;
* incorrect payment instructions;
* wallet compromise or loss;
* misuse of APIs, webhooks, integrations, or credentials;
* actions by Merchant employees, agents, contractors, or users; or
* an investigation caused by the Merchant’s conduct.

Outpay may control the defence and settlement of an indemnified matter. The Merchant must reasonably cooperate and must not settle a claim in a manner that admits liability or imposes obligations on an Outpay-protected party without written consent.

## 38. Exclusion of damages

To the maximum extent permitted by applicable law, Adelecte and its proprietor, affiliates, employees, contractors, representatives, licensors, and service providers will not be liable for:

* indirect damages;
* incidental damages;
* special damages;
* consequential damages;
* exemplary damages;
* punitive damages;
* loss of profits;
* loss of revenue;
* loss of digital assets;
* loss of business;
* loss of customers;
* loss of opportunity;
* loss of goodwill;
* loss or corruption of data;
* business interruption;
* replacement-service costs;
* tax liabilities;
* regulatory penalties;
* wallet compromise;
* private-key loss;
* stablecoin depegging; or
* losses arising from an irreversible transaction,

regardless of the legal theory and even if advised that such loss was possible.

## 39. Liability cap

To the maximum extent permitted by applicable law, the total aggregate liability of Adelecte and all related protected parties for all claims arising from or relating to the Services or these Terms will not exceed:

1. the total fees actually paid by you directly to Adelecte for the Services during the three months immediately preceding the event giving rise to the claim; or
2. US$100,

whichever is greater.

For a Payer who has paid no fee directly to Adelecte, aggregate liability will not exceed US$100.

The limitations in these Terms apply collectively to all claims and will not increase because more than one claim, claimant, event, legal theory, or protected party is involved.

Nothing in these Terms excludes or limits liability to the extent that such liability cannot lawfully be excluded or limited.

## 40. Time limit for business claims

To the extent permitted by law, any claim by a Merchant arising from or relating to the Services or these Terms must be commenced within twelve months after the Merchant knew or reasonably should have known of the events giving rise to the claim.

Claims not commenced within that period are permanently barred.

This section does not apply where a mandatory law requires a longer limitation period.

## 41. Force majeure

Adelecte is not liable for delay, interruption, failure, or loss caused by events beyond its reasonable control, including:

* natural disasters;
* fire;
* flood;
* severe weather;
* epidemic or pandemic;
* war;
* terrorism;
* civil unrest;
* labour disputes;
* government action;
* court orders;
* sanctions;
* internet outages;
* telecommunications failures;
* power failures;
* cloud-provider failures;
* cyberattacks;
* denial-of-service attacks;
* blockchain congestion;
* protocol failures;
* chain reorganizations;
* validator, sequencer, bridge, oracle, issuer, wallet, or RPC failures;
* software supply-chain incidents; or
* failure of third-party infrastructure.

## 42. Governing law and disputes

### 42.1 Business users

For Merchants and other persons using the Services for business or commercial purposes, these Terms are governed by the laws of India and the laws applicable in **Tamil Nadu, India**, without regard to conflict-of-laws principles.

The parties will first attempt in good faith to resolve a dispute by written notice and negotiation for at least thirty days.

Subject to mandatory applicable law, the courts located in **Coimbatore, Tamil Nadu, India** will have exclusive jurisdiction over disputes arising from or relating to these Terms or the Services.

### 42.2 Consumers

If you are legally considered a consumer, nothing in these Terms deprives you of mandatory rights, remedies, limitation periods, jurisdiction, or venue protections that cannot lawfully be waived.

### 42.3 Equitable relief

Adelecte may seek injunctive or equitable relief in any court of competent jurisdiction to protect intellectual property, confidential information, security, systems, or users.

## 43. Notices and electronic communications

You consent to receive agreements, disclosures, notices, invoices, security alerts, and other communications electronically.

Outpay may provide notice through:

* the Services;
* the dashboard;
* the email address associated with your account;
* the Outpay website; or
* another reasonable electronic method.

You are responsible for maintaining a current email address and reviewing notices.

Legal notices to Adelecte must be sent to **[legal@outpay.tech](mailto:legal@outpay.tech)**.

## 44. Complaints

General support requests may be sent to **[legal@outpay.tech](mailto:legal@outpay.tech)**.

Legal complaints may be sent to **[legal@outpay.tech](mailto:legal@outpay.tech)**.

Where legally required, consumer or grievance-related complaints may be directed to:

**Grievance Officer:** Tharun Pranav Sakthivel
**Email:** legal@outpay.tech

Merchants remain responsible for handling complaints regarding their own goods, services, fulfilment, billing, and refunds.

## 45. Changes to these Terms

Outpay may update these Terms to reflect:

* product changes;
* legal or regulatory requirements;
* security developments;
* pricing changes;
* new features;
* risk-management requirements; or
* changes to third-party services.

The revised Terms will identify the date of the latest update.

Where reasonably appropriate, Outpay will provide advance notice of material changes. Changes required for legal, compliance, security, fraud-prevention, or technical reasons may take effect immediately.

Continued use of the Services after revised Terms become effective constitutes acceptance of those Terms.

If you do not agree to a revision, you must stop using the Services.

## 46. Assignment

You may not assign or transfer these Terms, your account, or your rights under these Terms without Adelecte’s prior written consent.

Adelecte may assign or transfer these Terms in connection with a restructuring, incorporation, merger, acquisition, financing, sale of assets, transfer of the Outpay business, or operation by a successor entity.

## 47. Entire agreement and order of precedence

These Terms, together with incorporated policies and any applicable order form or separate written agreement, constitute the entire agreement concerning the Services.

If documents conflict, the following order applies unless expressly stated otherwise:

1. a separately signed written agreement;
2. an order form;
3. a data-processing agreement;
4. service-specific terms;
5. these Terms;
6. incorporated policies; and
7. documentation.

## 48. Severability

If any provision is held unlawful, invalid, or unenforceable, it will be enforced to the maximum extent permitted and modified only as much as necessary.

The remaining provisions will remain in effect.

## 49. Waiver

A failure or delay by Adelecte to enforce a provision is not a waiver.

A waiver is effective only if in writing and applies only to the specific matter identified.

## 50. No third-party beneficiaries

Except for persons expressly protected by the indemnity, release, warranty-disclaimer, and liability provisions, these Terms do not create enforceable rights for third parties.

## 51. Relationship of the parties

These Terms do not create a partnership, franchise, employment, agency, fiduciary, joint-venture, or exclusive relationship.

Neither party may bind the other without written authorization.

## 52. Interpretation

Headings are for convenience only.

“Include,” “includes,” and “including” mean “including without limitation.”

The singular includes the plural and vice versa where context permits.

Any ambiguity will not automatically be interpreted against the party that drafted the Terms.

## 53. Language

The controlling language of these Terms is English.

Any translation is provided for convenience only. To the extent permitted by applicable law, the English version controls in the event of inconsistency.

## 54. Survival

Provisions that by their nature should survive termination will survive, including provisions concerning:

* fees;
* taxes;
* ownership;
* intellectual property;
* compliance records;
* disclaimers;
* assumption of risk;
* releases;
* indemnification;
* liability limitations;
* dispute resolution; and
* interpretation.

## 55. Contact

Outpay is a product of Adelecte.

**Legal operator:**
41, Thavasi Nagar
Coimbatore - 641025
India

**Contact:** [legal@outpay.tech](mailto:legal@outpay.tech)

`;
