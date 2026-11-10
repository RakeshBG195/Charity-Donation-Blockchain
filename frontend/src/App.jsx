import { useEffect, useState } from "react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { getCharityContract } from "./blockchain/contract";
import { Heart, Wallet, ShieldCheck, PlusCircle, RefreshCw, HandHeart, Clock, Coins, LayoutDashboard, Activity, Menu, X, ArrowUpRight, Zap, CircleDollarSign, Network, FileText, ExternalLink, Trophy, Bell, Award, BarChart3, Download, Flag, Copy, Eye, CheckCircle2, CalendarDays, TrendingUp } from "lucide-react";
import "./App.css";

const particles = Array.from({ length: 24 }, (_, i) => i);

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const route = location.pathname.split("/").filter(Boolean)[0] || "dashboard";
  const page = ["dashboard","create","campaigns","transactions","leaderboard","notifications","report","certificates"].includes(route) ? route : "dashboard";
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [topDonors, setTopDonors] = useState([]);
  const [notifications, setNotifications] = useState(() => { try { return JSON.parse(localStorage.getItem("charitychain_notifications") || "[]"); } catch { return []; } });
  const [networkLabel, setNetworkLabel] = useState("NOT CONNECTED");
  const [networkConnected, setNetworkConnected] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [form, setForm] = useState({ title: "", description: "", beneficiary: "", goal: "", duration: "30" });
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [copiedHash, setCopiedHash] = useState("");
  const [verificationHash, setVerificationHash] = useState("");
  const [verificationResult, setVerificationResult] = useState(null);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    try { localStorage.setItem("charitychain_notifications", JSON.stringify(notifications)); } catch { /* storage may be unavailable */ }
  }, [notifications]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  async function copyHash(hash) {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      window.setTimeout(() => setCopiedHash(""), 1800);
    } catch { setMessage("Clipboard access was blocked by the browser. Select and copy the hash manually."); }
  }

  function disconnectWallet() {
    // Disconnect this website's active wallet session. MetaMask permissions remain unchanged.
    setContract(null);
    setAccount("");
    setCampaigns([]);
    setTransactions([]);
    setTopDonors([]);
    setVerificationHash("");
    setVerificationResult(null);
    setNetworkLabel("DISCONNECTED");
    setNetworkConnected(false);
    setSelectedCampaign(null);
    setSelectedTransaction(null);
    setMessage("Wallet disconnected from CharityChain.");
  }

  async function connectWallet() {
    try {
      setMessage("Connecting wallet...");
      const charity = await getCharityContract();
      const signer = await charity.runner.getAddress();
      setContract(charity);
      setAccount(signer);
      const network = await charity.runner.provider.getNetwork();
      setNetworkLabel(`${network.name === "unknown" ? `CHAIN ${network.chainId}` : network.name.toUpperCase()} · ${network.chainId}`);
      setNetworkConnected(true);
      setMessage("Wallet connected successfully!");
      await loadCampaigns(charity);
    } catch (error) {
      setNetworkConnected(false);
      setNetworkLabel("DISCONNECTED");
      setMessage(error.shortMessage || error.message || "Wallet connection failed.");
    }
  }

  async function loadTransactions(activeContract = contract, campaignList = campaigns) {
    if (!activeContract) return;
    try {
      setTransactionsLoading(true);
      const latestBlock = await activeContract.runner.provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 4999);

      const eventTypes = [
        { name: "Donation", filter: activeContract.filters.DonationReceived() },
        { name: "Withdrawal", filter: activeContract.filters.FundsWithdrawn() },
        { name: "Refund", filter: activeContract.filters.RefundIssued() },
      ];

      const allLogs = await Promise.all(
        eventTypes.map(async (type) => {
          const logs = await activeContract.queryFilter(type.filter, fromBlock, latestBlock);
          return logs.map((log) => ({ ...log, activityType: type.name }));
        })
      );

      const logs = allLogs.flat();

      // Build donor rankings from confirmed on-chain donation and refund events.
      // Refunds are subtracted so the leaderboard shows net contributions.
      const donorTotals = new Map();
      for (const log of logs) {
        if (log.activityType !== "Donation" && log.activityType !== "Refund") continue;
        const donorAddress = String(
          log.activityType === "Donation" ? log.args.donor : log.args.donor
        ).toLowerCase();
        const campaignId = log.args.campaignId.toString();
        if (!donorTotals.has(donorAddress)) {
          donorTotals.set(donorAddress, {
            address: donorAddress,
            netWei: 0n,
            donationCount: 0,
            campaigns: new Set(),
          });
        }
        const donor = donorTotals.get(donorAddress);
        const amountWei = log.args.amount;
        if (log.activityType === "Donation") {
          donor.netWei += amountWei;
          donor.donationCount += 1;
          donor.campaigns.add(campaignId);
        } else {
          donor.netWei -= amountWei;
        }
      }

      const rankedDonors = Array.from(donorTotals.values())
        .filter((donor) => donor.netWei > 0n)
        .sort((a, b) => (a.netWei > b.netWei ? -1 : a.netWei < b.netWei ? 1 : 0))
        .slice(0, 10)
        .map((donor) => ({
          address: donor.address,
          total: ethers.formatEther(donor.netWei),
          donationCount: donor.donationCount,
          campaignCount: donor.campaigns.size,
        }));
      setTopDonors(rankedDonors);

      const blockTimestamps = new Map();
      const rows = await Promise.all(logs.map(async (log) => {
        const args = log.args;
        const campaignId = args.campaignId.toString();
        const campaign = campaignList.find((item) => item.id === campaignId);
        let timestamp = null;

        if (blockTimestamps.has(log.blockNumber)) {
          timestamp = blockTimestamps.get(log.blockNumber);
        } else {
          const block = await activeContract.runner.provider.getBlock(log.blockNumber);
          timestamp = block?.timestamp ?? null;
          blockTimestamps.set(log.blockNumber, timestamp);
        }

        const wallet = log.activityType === "Withdrawal" ? args.beneficiary : args.donor;
        return {
          id: `${log.transactionHash}-${log.index ?? log.logIndex}`,
          type: log.activityType,
          campaignId,
          campaignTitle: campaign?.title || `Campaign #${campaignId}`,
          wallet: wallet || "Unknown",
          amount: ethers.formatEther(args.amount),
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp,
        };
      }));

      rows.sort((a, b) => b.blockNumber - a.blockNumber);
      setTransactions(rows);

      // Rebuild notification history from confirmed on-chain events so the
      // Notifications page is populated even after a refresh or reconnect.
      const historicalNotifications = rows.map((tx) => ({
        id: tx.id,
        type: tx.type === "Donation" ? "donation" : tx.type === "Withdrawal" ? "withdrawal" : "refund",
        title: tx.type === "Donation" ? "Donation confirmed" : tx.type === "Withdrawal" ? "Funds withdrawn" : "Refund issued",
        detail: `${tx.campaignTitle} · ${tx.amount} ETH · ${tx.wallet.slice(0, 8)}...${tx.wallet.slice(-6)}`,
        hash: tx.transactionHash,
        time: tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : `Block ${tx.blockNumber}`,
        blockNumber: tx.blockNumber,
      }));
      setNotifications((previous) => {
        const merged = new Map();
        [...historicalNotifications, ...previous].forEach((item) => merged.set(item.id, item));
        return Array.from(merged.values())
          .sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0))
          .slice(0, 50);
      });
    } catch (error) {
      setMessage(error.shortMessage || error.message || "Unable to load blockchain transactions.");
    } finally {
      setTransactionsLoading(false);
    }
  }

  async function loadCampaigns(activeContract = contract) {
    if (!activeContract) return setMessage("Connect your wallet first.");
    try {
      setLoading(true);
      const count = await activeContract.campaignCount();
      const results = [];
      for (let i = 1n; i <= count; i++) {
        const c = await activeContract.getCampaignDetails(i);
        results.push({ id: c.id.toString(), title: c.title, description: c.description, creator: c.creator, beneficiary: c.beneficiary, goal: c.goal, raised: c.raised, deadline: c.deadline, withdrawn: c.withdrawn });
      }
      const orderedCampaigns = results.reverse();
      setCampaigns(orderedCampaigns);
      await loadTransactions(activeContract, orderedCampaigns);
    } catch (error) {
      setMessage(error.shortMessage || error.message || "Unable to load campaigns.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!contract) return undefined;

    const eventNames = ["CampaignCreated", "DonationReceived", "FundsWithdrawn", "RefundIssued"];
    const handlers = {};
    eventNames.forEach((eventName) => {
      handlers[eventName] = (...args) => {
        const event = args[args.length - 1];
        const campaignId = args[0]?.toString?.() || "?";
        const amount = eventName === "CampaignCreated" ? args[3] : args[2];
        const amountText = amount != null && typeof amount === "bigint" ? `${ethers.formatEther(amount)} ETH` : "";
        const labels = { CampaignCreated: "Campaign created", DonationReceived: "New donation received", FundsWithdrawn: "Funds withdrawn", RefundIssued: "Donation refund issued" };
        const categories = { CampaignCreated: "campaign", DonationReceived: "donation", FundsWithdrawn: "withdrawal", RefundIssued: "refund" };
        const detail = eventName === "CampaignCreated" ? `Campaign #${campaignId} was published on-chain · Goal ${amountText}` : `Campaign #${campaignId}${amountText ? ` · ${amountText}` : ""}`;
        const txHash = event?.log?.transactionHash;
        const logIndex = event?.log?.index ?? event?.log?.logIndex;
        const stableId = txHash ? `${txHash}-${logIndex ?? eventName}` : `${eventName}-${campaignId}-${event?.log?.blockNumber ?? "pending"}`;
        setNotifications((previous) => {
          if (previous.some((item) => item.id === stableId)) return previous;
          return [{ id: stableId, type: categories[eventName], title: labels[eventName], detail, hash: txHash, time: new Date().toLocaleString(), blockNumber: event?.log?.blockNumber ?? 0 }, ...previous].slice(0, 50);
        });
        loadCampaigns(contract);
      };
      contract.on(eventName, handlers[eventName]);
    });
    return () => eventNames.forEach((eventName) => contract.off(eventName, handlers[eventName]));
  }, [contract]);

  async function createCampaign(e) {
    e.preventDefault();
    if (!contract) return setMessage("Please connect your wallet first.");
    try {
      if (!form.title.trim() || !form.description.trim()) throw new Error("Enter a campaign title and description.");
      if (!ethers.isAddress(form.beneficiary)) throw new Error("Please enter a valid beneficiary wallet address.");
      if (!Number.isFinite(Number(form.goal)) || Number(form.goal) <= 0) throw new Error("Enter a valid campaign goal.");
      if (!Number.isInteger(Number(form.duration)) || Number(form.duration) <= 0) throw new Error("Enter a valid duration in days.");
      setLoading(true);
      setMessage("Waiting for campaign transaction...");
      const tx = await contract.createCampaign(form.title.trim(), form.description.trim(), form.beneficiary, ethers.parseEther(form.goal), Number(form.duration));
      await tx.wait();
      setMessage("Campaign created successfully!");
      setForm({ title: "", description: "", beneficiary: "", goal: "", duration: "30" });
      await loadCampaigns();
    } catch (error) {
      setMessage(error.reason || error.shortMessage || error.message);
    } finally { setLoading(false); }
  }

  async function donate(id) {
    if (!contract) return setMessage("Connect your wallet first.");
    const amount = window.prompt("Enter donation amount in ETH:");
    if (!amount) return;
    try {
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error("Enter a valid donation amount.");
      setLoading(true);
      setMessage("Waiting for donation confirmation...");
      const tx = await contract.donate(id, { value: ethers.parseEther(amount) });
      await tx.wait();
      setMessage("Donation successful!");
      await loadCampaigns();
    } catch (error) {
      setMessage(error.reason || error.shortMessage || error.message);
    } finally { setLoading(false); }
  }

  async function withdraw(id) {
    if (!contract) return;
    try {
      setLoading(true); setMessage("Processing withdrawal...");
      const tx = await contract.withdrawFunds(id); await tx.wait();
      setMessage("Funds withdrawn successfully!"); await loadCampaigns();
    } catch (error) { setMessage(error.reason || error.shortMessage || error.message); }
    finally { setLoading(false); }
  }

  async function refund(id) {
    if (!contract) return;
    try {
      setLoading(true); setMessage("Processing refund...");
      const tx = await contract.claimRefund(id); await tx.wait();
      setMessage("Refund claimed successfully!"); await loadCampaigns();
    } catch (error) { setMessage(error.reason || error.shortMessage || error.message); }
    finally { setLoading(false); }
  }

  async function verifyTransaction(sharedHash = "") {
    const hashInput =
  typeof sharedHash === "string" && sharedHash.trim()
    ? sharedHash
    : verificationHash;

const hash = hashInput.trim();
setVerificationResult(null);
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      setVerificationResult({ ok: false, title: "Invalid transaction hash", detail: "Paste the complete 66-character transaction hash beginning with 0x." });
      return;
    }
    if (!contract) {
      setVerificationResult({ ok: false, title: "Wallet not connected", detail: "Connect MetaMask to the same Hardhat Local network used by this project, then try again." });
      return;
    }
    try {
      setTransactionsLoading(true);
      const provider = contract.runner.provider;
      const receipt = await provider.getTransactionReceipt(hash);
      if (!receipt) {
        setVerificationResult({ ok: false, title: "Transaction not found", detail: "This RPC node has no receipt for that hash. Check the hash and make sure the same Hardhat node is running." });
        return;
      }
      if (Number(receipt.status) !== 1) {
        setVerificationResult({ ok: false, title: "Transaction failed", detail: `The transaction was mined in block ${receipt.blockNumber}, but its execution failed.` });
        return;
      }
      const contractAddress = (await contract.getAddress()).toLowerCase();
      if ((receipt.to || "").toLowerCase() !== contractAddress) {
        setVerificationResult({ ok: false, title: "Not a CharityChain transaction", detail: "This transaction was not sent to the CharityChain smart contract currently connected." });
        return;
      }
      let donation = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== contractAddress) continue;
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === "DonationReceived") { donation = parsed.args; break; }
        } catch { /* Ignore unrelated contract events. */ }
      }
      if (!donation) {
        setVerificationResult({ ok: false, title: "No donation event found", detail: "The transaction succeeded, but it does not contain a DonationReceived event from this CharityChain contract." });
        return;
      }
      const campaignId = donation.campaignId.toString();
      const campaign = campaigns.find(item => item.id === campaignId);
      const block = await provider.getBlock(receipt.blockNumber);
      setVerificationResult({
        ok: true,
        title: "Donation verified on blockchain",
        detail: `${ethers.formatEther(donation.amount)} ETH was donated to Campaign #${campaignId}${campaign ? ` — ${campaign.title}` : ""}.`,
        donor: donation.donor,
        blockNumber: receipt.blockNumber,
        date: block?.timestamp ? new Date(block.timestamp * 1000).toLocaleString() : "Unavailable",
        hash
      });
    } catch (error) {
      setVerificationResult({ ok: false, title: "Verification error", detail: error.shortMessage || error.reason || error.message || "Unable to verify this transaction." });
    } finally { setTransactionsLoading(false); }
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sharedHash = params.get("verify");
    if (page === "certificates" && sharedHash && contract) {
      setVerificationHash(sharedHash);
      verifyTransaction(sharedHash);
    }
  }, [location.search, page, contract]);

  function downloadCertificate(tx) {
    const campaign = campaigns.find((item) => item.id === tx.campaignId);
    const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const certificateId = `CC-31337-${tx.campaignId}-${tx.transactionHash.slice(2, 14).toUpperCase()}`;
    const verificationUrl = `${window.location.origin}/certificates?verify=${encodeURIComponent(tx.transactionHash)}&certificate=${encodeURIComponent(certificateId)}`;
    const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(verificationUrl)}`;
    const certificateWindow = window.open("", "_blank", "width=900,height=700");
    if (!certificateWindow) { setMessage("Allow pop-ups to generate your certificate."); return; }
    certificateWindow.document.write(`<!doctype html><html><head><title>CharityChain Donation Certificate</title><style>*{box-sizing:border-box}body{font-family:Georgia,serif;background:#071323;padding:28px;color:#17283d}.certificate{position:relative;max-width:790px;margin:20px auto;padding:52px 48px;border:8px double #167fa7;outline:1px solid #8fdcf5;outline-offset:-17px;background:linear-gradient(135deg,#fff 0%,#f2fbff 100%);text-align:center;box-shadow:0 20px 70px #0008}.brand{font:bold 18px Arial;letter-spacing:5px;color:#087da9}.eyebrow{font:10px Arial;letter-spacing:3px;color:#607e91;margin-top:22px}.certificate h1{font-size:36px;color:#123b57;margin:12px 0}.line{height:1px;background:linear-gradient(90deg,transparent,#70b7d1,transparent);margin:25px 0}.amount{font:700 38px Arial;color:#087e8b;margin:18px}.detail{font:12px Arial;line-height:2.1;overflow-wrap:anywhere;color:#34546a}.qr-wrap{display:grid;justify-items:center;gap:8px;margin:18px auto}.qr-wrap img{width:132px;height:132px;padding:5px;border:1px solid #b8d9e8;background:#fff}.qr-wrap small{font:9px Arial;letter-spacing:1.5px;color:#56798b}.verified{display:inline-block;margin:10px;padding:9px 18px;border:2px solid #15966c;border-radius:30px;color:#08784f;font:bold 11px Arial;letter-spacing:2px}.print{margin:20px;padding:12px 22px;background:#087eaa;color:white;border:0;border-radius:6px;cursor:pointer}@media(max-width:600px){.certificate{padding:36px 24px}.certificate h1{font-size:27px}}@media print{body{background:white;padding:0}.certificate{box-shadow:none;margin:0;max-width:none;min-height:95vh}.print{display:none}}</style></head><body><div class="certificate"><div class="brand">CHARITYCHAIN</div><div class="eyebrow">BLOCKCHAIN-RECORDED CONTRIBUTION</div><h1>Certificate of Donation</h1><p>This certificate acknowledges that</p><h2>${safe(tx.wallet)}</h2><p>made a confirmed contribution of</p><div class="amount">${safe(tx.amount)} ETH</div><div class="verified">✓ ON-CHAIN EVENT RECORDED</div><p>towards the campaign</p><h2>${safe(campaign?.title || tx.campaignTitle)}</h2><div class="line"></div><div class="detail">Certificate ID: ${safe(certificateId)}<br>Transaction: ${safe(tx.transactionHash)}<br>Campaign ID: ${safe(tx.campaignId)}<br>Block: ${safe(tx.blockNumber)}<br>Network: Hardhat Local (31337)<br>Date: ${safe(tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : "Unavailable")}<br><br>Verified from the CharityChain smart-contract event record.</div><div class="qr-wrap"><img src="${qrImage}" alt="QR code containing CharityChain transaction details"/><small>SCAN TO OPEN ON-CHAIN VERIFICATION</small><a href="${safe(verificationUrl)}" style="font:10px Arial;color:#087eaa;overflow-wrap:anywhere">Verify certificate online</a></div><div class="line"></div><p class="detail">This is a digital acknowledgement of an on-chain transaction, not a tax receipt.</p></div><center><button class="print" onclick="window.print()">Print / Save as PDF</button></center></body></html>`);
    certificateWindow.document.close();
  }

  const totalRaised = campaigns.reduce((sum, c) => sum + Number(ethers.formatEther(c.raised)), 0);
  const totalGoal = campaigns.reduce((sum, c) => sum + Number(ethers.formatEther(c.goal)), 0);
  const completedCampaigns = campaigns.filter(c => Number(c.raised) >= Number(c.goal)).length;
  const activeCampaigns = campaigns.filter(c => Number(c.deadline) * 1000 >= Date.now() && Number(c.raised) < Number(c.goal)).length;
  const donatedEth = transactions.filter(t => t.type === "Donation").reduce((sum, t) => sum + Number(t.amount), 0);
  const withdrawnEth = transactions.filter(t => t.type === "Withdrawal").reduce((sum, t) => sum + Number(t.amount), 0);
  const refundedEth = transactions.filter(t => t.type === "Refund").reduce((sum, t) => sum + Number(t.amount), 0);
  const campaignSuccessRate = campaigns.length ? (completedCampaigns / campaigns.length) * 100 : 0;
  const dailyDonationData = (() => {
    const days = [];
    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const key = date.toLocaleDateString();
      const total = transactions.filter(t => t.type === "Donation" && t.timestamp && new Date(t.timestamp * 1000).toLocaleDateString() === key)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      days.push({ label: date.toLocaleDateString(undefined, { weekday: "short" }), date: key, total });
    }
    return days;
  })();
  const dailyDonationMax = Math.max(0.000001, ...dailyDonationData.map(day => day.total));

  function handleScenePointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    event.currentTarget.style.setProperty("--pointer-x", `${x * 2}`);
    event.currentTarget.style.setProperty("--pointer-y", `${y * 2}`);
  }

  function handleScenePointerLeave(event) {
    event.currentTarget.style.setProperty("--pointer-x", "0");
    event.currentTarget.style.setProperty("--pointer-y", "0");
  }

  function navigateTo(section) {
    navigate(`/${section}`);
    setActiveSection(section);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className={`app-shell four-d-cyber page-${page}`} data-page={page} id="dashboard" onPointerMove={handleScenePointerMove} onPointerLeave={handleScenePointerLeave}>
      <div className="chain-network-scene" aria-hidden="true">
        <svg className="network-routes" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path d="M80 180 L310 300 L520 170 L760 310 L1010 180" />
          <path d="M120 610 L350 490 L590 650 L840 500 L1110 640" />
          <path d="M310 300 L350 490 M520 170 L590 650 M760 310 L840 500" />
          <path className="route-pulse" d="M80 180 L310 300 L520 170 L760 310 L1010 180" />
          <path className="route-pulse route-pulse-two" d="M120 610 L350 490 L590 650 L840 500 L1110 640" />
        </svg>
        {Array.from({ length: 7 }, (_, i) => <div className={`chain-block chain-block-${i + 1}`} key={i}><span /><span /><span /><b>{String(i + 1).padStart(2, "0")}</b></div>)}
        <div className="network-data data-one">TX VERIFIED <i /></div>
        <div className="network-data data-two">BLOCK CONFIRMED <i /></div>
        <div className="network-data data-three">HASH MATCH <i /></div>
      </div>

      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <a className="brand" href="/dashboard" onClick={(e) => { e.preventDefault(); navigateTo("dashboard"); }}><span className="brand-mark"><Heart size={21} /></span><span>CHARITY<span className="brand-accent">CHAIN</span></span></a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav">
          <button className={`nav-item ${page === "dashboard" ? "active" : ""}`} onClick={() => navigateTo("dashboard")}><LayoutDashboard size={18} />Dashboard</button>
          <button className={`nav-item ${page === "create" ? "active" : ""}`} onClick={() => navigateTo("create")}><PlusCircle size={18} />Create Campaign</button>
          <button className={`nav-item ${page === "campaigns" ? "active" : ""}`} onClick={() => navigateTo("campaigns")}><Activity size={18} />Campaigns</button>
          <button className={`nav-item ${page === "transactions" ? "active" : ""}`} onClick={() => navigateTo("transactions")}><FileText size={18} />Transactions</button>
          <button className={`nav-item ${page === "leaderboard" ? "active" : ""}`} onClick={() => navigateTo("leaderboard")}><Trophy size={18} />Top Donors</button>
          <button className={`nav-item ${page === "notifications" ? "active" : ""}`} onClick={() => navigateTo("notifications")}><Bell size={18} />Notifications</button>
          <button className={`nav-item ${page === "report" ? "active" : ""}`} onClick={() => navigateTo("report")}><BarChart3 size={18} />Transparency</button>
          <button className={`nav-item ${page === "certificates" ? "active" : ""}`} onClick={() => navigateTo("certificates")}><Award size={18} />Certificates</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="network-card"><span className="network-icon"><Network size={17} /></span><div><strong>NETWORK STATUS</strong><small className={networkConnected ? "network-connected" : "network-disconnected"}><i /> {networkLabel}</small></div></div>
          <div className="sidebar-foot">DECENTRALIZED GIVING<br />POWERED BY SMART CONTRACTS</div>
        </div>
      </aside>
      {mobileMenu && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-btn" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu ? <X /> : <Menu />}</button>
          <div className="topbar-context"><span className="topbar-kicker">BLOCKCHAIN CHARITY ECOSYSTEM</span><span className="topbar-title">Transparent giving. Real impact.</span></div>
          <div className="topbar-actions"><span className={`network-pill ${networkConnected ? "network-pill-connected" : "network-pill-disconnected"}`}><i className="online-dot" /> {networkConnected ? networkLabel : "NETWORK DISCONNECTED"}</span><button className="connect-btn" onClick={connectWallet} disabled={loading}><Wallet size={17} />{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}</button>{account && <button type="button" className="secondary-btn" onClick={disconnectWallet} disabled={loading} title="Disconnect wallet from this website">Disconnect</button>}</div>
        </header>

        <div className="page-content">
          {page === "dashboard" && (<>
          <section className="hero-panel">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> DECENTRALIZED CHARITY ECOSYSTEM</div>
              <h1>Make Every Donation<br /><span>Count.</span></h1>
              <p>A transparent donation ecosystem powered by blockchain technology. Every contribution is recorded securely and verifiably on-chain.</p>
              <div className="hero-actions"><button className="primary-btn" onClick={() => navigateTo("campaigns")}>Explore Campaigns <ArrowUpRight size={17} /></button><button className="secondary-btn" onClick={() => navigateTo("create")}><PlusCircle size={17} /> Start a Campaign</button></div>
              <div className="trust-line"><ShieldCheck size={16} /> Transparent <b>·</b> Secure <b>·</b> Decentralized</div>
            </div>
            <div className="hero-visual network-hero-visual" aria-hidden="true"><div className="network-platform"><div className="platform-grid" /><div className="platform-link link-a" /><div className="platform-link link-b" /><div className="platform-link link-c" /><div className="platform-node node-a"><Network size={22} /></div><div className="platform-node node-b"><ShieldCheck size={22} /></div><div className="platform-node node-c"><Heart size={22} /></div><div className="platform-node node-core"><HandHeart size={30} /></div><div className="platform-node node-d"><Zap size={20} /></div><div className="data-packet packet-a" /><div className="data-packet packet-b" /><div className="data-packet packet-c" /></div><div className="visual-caption">◉ BLOCKCHAIN NETWORK LIVE</div></div>
            <div className="hero-index">CC / 001</div>
          </section>

          {message && <div className="message" role="status"><span className="message-indicator" /><span>{message}</span><button onClick={() => setMessage("")} aria-label="Dismiss message"><X size={17} /></button></div>}

          <section className="stats-grid">
            <div className="stat-card"><div className="stat-top"><span>TOTAL CAMPAIGNS</span><HandHeart size={18} /></div><strong>{campaigns.length}</strong><small>Registered on-chain</small></div>
            <div className="stat-card"><div className="stat-top"><span>TOTAL DONATIONS</span><Coins size={18} /></div><strong>{totalRaised.toFixed(4)} <em>ETH</em></strong><small>Funds contributed</small></div>
            <div className="stat-card"><div className="stat-top"><span>ACTIVE CAMPAIGNS</span><Activity size={18} /></div><strong>{activeCampaigns}</strong><small>Currently accepting support</small></div>
            <div className="stat-card"><div className="stat-top"><span>COMPLETED</span><ShieldCheck size={18} /></div><strong>{completedCampaigns}</strong><small>Funding goals reached</small></div>
          </section>

          </>)}

          {page === "create" && (
<section className="create-section content-section" id="create">
            <div className="section-heading"><div><span className="section-code">01 / CREATE</span><h2>Launch a Campaign</h2><p>Put a cause in motion with a transparent smart contract.</p></div><div className="heading-icon"><PlusCircle size={23} /></div></div>
            <form className="campaign-form" onSubmit={createCampaign}>
              <div className="form-intro"><span className="form-pulse" /> CAMPAIGN CONFIGURATION</div>
              <div className="form-field"><label>CAMPAIGN TITLE</label><input placeholder="e.g. Support Rural Education" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="form-field"><label>DESCRIPTION</label><textarea placeholder="Explain the cause and how donations will be used..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></div>
              <div className="form-field"><label>BENEFICIARY WALLET ADDRESS</label><input placeholder="0x..." value={form.beneficiary} onChange={e => setForm({ ...form, beneficiary: e.target.value })} required /></div>
              <div className="form-row"><div className="form-field"><label>FUNDING GOAL (ETH)</label><input type="number" step="0.001" min="0.001" placeholder="5 ETH" value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} required /></div><div className="form-field"><label>DURATION (DAYS)</label><input type="number" min="1" placeholder="30 days" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} required /></div></div>
              <div className="form-footer"><p className="form-note">{!contract ? "Connect MetaMask to publish your campaign on-chain." : "Your campaign will be recorded by the connected smart contract."}</p><button className="primary-btn" disabled={loading || !contract}><PlusCircle size={17} />{loading ? "PROCESSING..." : "DEPLOY CAMPAIGN"}</button></div>
            </form>
          </section>
)}

          {page === "campaigns" && (
<section className="campaign-section content-section" id="campaigns">
            <div className="section-heading campaign-heading"><div><span className="section-code">02 / DISCOVER</span><h2>Explore Campaigns</h2><p>Find a cause. Make an impact. Verify every contribution.</p></div><button className="refresh-btn" onClick={() => loadCampaigns()} disabled={!contract || loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh</button></div>
            {!account && <div className="empty-state"><Wallet size={32} /><h3>Connect Your Wallet</h3><p>Connect MetaMask to load campaigns and interact with the blockchain.</p></div>}
            {account && campaigns.length === 0 && <div className="empty-state"><HandHeart size={32} /><h3>No Campaigns Found</h3><p>Create the first charity campaign on CharityChain.</p></div>}
            <div className="campaign-grid">
              {campaigns.map(c => {
                const goal = Number(ethers.formatEther(c.goal));
                const raised = Number(ethers.formatEther(c.raised));
                const progress = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
                const expired = Number(c.deadline) * 1000 < clockNow;
                const completed = raised >= goal;
                const isBeneficiary = account.toLowerCase() === c.beneficiary.toLowerCase();
                return <article className="campaign-card" key={c.id}>
                  <div className="campaign-card-top"><span className="campaign-tag">CAMPAIGN / {c.id.padStart(3, "0")}</span><Heart size={18} /></div>
                  <h3>{c.title}</h3><p className="campaign-description">{c.description}</p>
                  <div className="progress-info"><span>{raised.toFixed(4)} ETH RAISED</span><strong>{progress.toFixed(0)}%</strong></div>
                  <div className="progress-bar"><div style={{ width: `${progress}%` }} /></div>
                  <div className="milestone-row" aria-label="Campaign funding milestones">{[25, 50, 75, 100].map((step) => <span key={step} className={progress >= step ? "milestone reached" : "milestone"}><i />{step}%</span>)}</div>
                  <div className="goal-info"><span>GOAL: {goal} ETH</span><span><Clock size={13} /> {expired ? "EXPIRED" : completed ? "GOAL REACHED" : `${Math.max(0, Math.ceil((Number(c.deadline)*1000-clockNow)/86400000))} DAYS LEFT`}</span></div>
                  <div className="campaign-beneficiary-line"><span>BENEFICIARY WALLET</span><code title={c.beneficiary}>{c.beneficiary.slice(0,8)}...{c.beneficiary.slice(-5)}</code></div>
                  <div className="campaign-card-meta"><span><Activity size={13}/> {transactions.filter(tx => tx.campaignId === c.id && tx.type === "Donation").length} donations</span><span><CalendarDays size={13}/> {expired ? "Deadline passed" : `${Math.floor(Math.max(0, Number(c.deadline) * 1000 - clockNow) / 86400000)}d ${Math.floor((Math.max(0, Number(c.deadline) * 1000 - clockNow) % 86400000) / 3600000)}h remaining`}</span></div>
                  <button className="campaign-details-btn" onClick={() => setSelectedCampaign(c)}>VIEW CAMPAIGN DETAILS <ArrowUpRight size={14}/></button>
                  {!c.withdrawn && !completed && !expired && <button className="donate-btn" onClick={() => donate(c.id)} disabled={loading}><Heart size={16} /> DONATE NOW</button>}
                  {!c.withdrawn && completed && isBeneficiary && <button className="donate-btn" onClick={() => withdraw(c.id)} disabled={loading}><Coins size={16} /> WITHDRAW FUNDS</button>}
                  {!c.withdrawn && completed && !isBeneficiary && <span className="completed-label"><ShieldCheck size={15} /> FUNDING GOAL REACHED</span>}
                  {!completed && expired && <button className="refund-btn" onClick={() => refund(c.id)} disabled={loading}>CLAIM MY REFUND</button>}
                  {c.withdrawn && <span className="completed-label"><ShieldCheck size={15} /> FUNDS WITHDRAWN</span>}
                </article>;
              })}
            </div>
          </section>
)}

          {page === "transactions" && (
<section className="transactions-section content-section" id="transactions">
            <div className="section-heading campaign-heading">
              <div>
                <span className="section-code">03 / ON-CHAIN ACTIVITY</span>
                <h2>Live Transaction Tracker</h2>
                <p>Verified donation, withdrawal and refund events recorded on your local blockchain.</p>
              </div>
              <button className="refresh-btn" onClick={() => loadTransactions()} disabled={!contract || transactionsLoading}>
                <RefreshCw size={16} className={transactionsLoading ? "spin" : ""} /> Refresh
              </button>
            </div>

            {!account && (
              <div className="empty-state">
                <Wallet size={32} />
                <h3>Connect Your Wallet</h3>
                <p>Connect MetaMask to inspect blockchain transaction history.</p>
              </div>
            )}

            {account && transactions.length === 0 && (
              <div className="empty-state">
                <Activity size={32} />
                <h3>No Transactions Found</h3>
                <p>Confirmed donations, withdrawals and refunds will appear here.</p>
              </div>
            )}

            {transactions.length > 0 && (
              <div className="transaction-table-wrap">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>TYPE</th>
                      <th>CAMPAIGN</th>
                      <th>WALLET</th>
                      <th>AMOUNT</th>
                      <th>BLOCK / TIME</th>
                      <th>TRANSACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td><span className={`transaction-type ${tx.type.toLowerCase()}`}>{tx.type}</span></td>
                        <td>{tx.campaignTitle}<small>#{tx.campaignId}</small></td>
                        <td className="mono-address">{tx.wallet.slice(0, 6)}...{tx.wallet.slice(-4)}</td>
                        <td className="transaction-amount">{tx.amount} ETH</td>
                        <td><span>#{tx.blockNumber}</span><small>{tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : "Time unavailable"}</small></td>
                        <td>
                          <div className="transaction-actions"><button className="hash-copy" title={tx.transactionHash} onClick={() => setSelectedTransaction(tx)}>{tx.transactionHash.slice(0, 8)}...{tx.transactionHash.slice(-6)} <Eye size={13} /> Details</button><button className="hash-icon-btn" title="Copy full transaction hash" onClick={() => copyHash(tx.transactionHash)}>{copiedHash === tx.transactionHash ? <CheckCircle2 size={14}/> : <Copy size={14}/>}</button></div>{tx.type === "Donation" && <button className="certificate-btn" onClick={() => downloadCertificate(tx)} title="Generate donation certificate"><Award size={13} /> Certificate</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="transaction-footnote">Showing events from the latest 5,000 blocks of the connected network.</div>
          </section>
)}

          {page === "leaderboard" && (
<section className="leaderboard-section content-section" id="leaderboard">
            <div className="section-heading campaign-heading">
              <div>
                <span className="section-code">04 / COMMUNITY IMPACT</span>
                <h2>Top Donor Leaderboard</h2>
                <p>Recognising the wallets making the biggest net contributions across campaigns.</p>
              </div>
              <div className="heading-icon"><Trophy size={23} /></div>
            </div>

            {!account && (
              <div className="empty-state">
                <Wallet size={32} />
                <h3>Connect Your Wallet</h3>
                <p>Connect MetaMask to calculate donor rankings from blockchain events.</p>
              </div>
            )}

            {account && topDonors.length === 0 && (
              <div className="empty-state">
                <Trophy size={32} />
                <h3>No Donors Yet</h3>
                <p>Confirmed donations will appear here, ranked by net contribution.</p>
              </div>
            )}

            {account && topDonors.length > 0 && (
              <>
              <div className="donor-podium" aria-label="Top three donors">
                {topDonors.slice(0, 3).map((donor, index) => (
                  <article className={`podium-card podium-${index + 1}`} key={donor.address}>
                    <span className="podium-medal">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</span>
                    <small>RANK {index + 1}</small>
                    <strong>{donor.address.slice(0, 8)}...{donor.address.slice(-5)}</strong>
                    <b>{Number(donor.total).toFixed(4)} ETH</b>
                    <span>{donor.donationCount} donations · {donor.campaignCount} campaigns</span>
                  </article>
                ))}
              </div>
              <div className="leaderboard-table-wrap">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>RANK</th>
                      <th>DONOR WALLET</th>
                      <th>NET CONTRIBUTION</th>
                      <th>DONATIONS</th>
                      <th>CAMPAIGNS SUPPORTED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDonors.map((donor, index) => (
                      <tr key={donor.address}>
                        <td><span className={`donor-rank rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span></td>
                        <td className="mono-address">{donor.address.slice(0, 8)}...{donor.address.slice(-6)}</td>
                        <td className="leaderboard-amount">{Number(donor.total).toFixed(4)} ETH</td>
                        <td>{donor.donationCount}</td>
                        <td>{donor.campaignCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
            <div className="transaction-footnote">Rankings use events from the latest 5,000 blocks. Refunds are deducted from donor totals.</div>
          </section>
)}

          {page === "notifications" && (
<section className="notifications-section content-section" id="notifications">
            <div className="section-heading campaign-heading"><div><span className="section-code">05 / LIVE UPDATES</span><h2>Blockchain Notifications</h2><p>Historical and live updates reconstructed from confirmed contract events.</p></div><button className="refresh-btn" onClick={() => loadTransactions()} disabled={!contract || transactionsLoading}><RefreshCw size={15}/> Sync events</button></div>
            <div className="notification-toolbar"><span><b>{notifications.length}</b> recorded events</span><button className="refresh-btn" onClick={() => { setNotifications([]); try { localStorage.removeItem("charitychain_notifications"); } catch {} }}><Bell size={15} /> Clear history</button></div>
            <div className="notification-filters" role="group" aria-label="Filter notifications">
              {[["all","All"],["donation","Donations"],["campaign","Campaigns"],["withdrawal","Withdrawals"],["refund","Refunds"]].map(([value,label]) => <button key={value} className={`notification-filter ${notificationFilter === value ? "active" : ""}`} onClick={() => setNotificationFilter(value)}>{label}<span>{value === "all" ? notifications.length : notifications.filter(item => item.type === value).length}</span></button>)}
            </div>
            {notifications.length === 0 ? <div className="empty-state"><Bell size={30}/><h3>No blockchain activity yet</h3><p>Once a campaign receives a donation, withdrawal or refund, its confirmed event will appear here. Use Sync events to refresh the history.</p></div> : (notifications.filter(item => notificationFilter === "all" || item.type === notificationFilter).length === 0 ? <div className="empty-state"><Bell size={30}/><h3>No matching notifications</h3><p>There are no events in this category yet.</p></div> : <div className="notification-list">{notifications.filter(item => notificationFilter === "all" || item.type === notificationFilter).map((item) => <article className="notification-item" key={item.id}><span className="notification-pulse"/><div><strong>{item.title}</strong><p>{item.detail}</p>{item.hash && <button className="notification-hash" onClick={() => copyHash(item.hash)}>{item.hash.slice(0,10)}...{item.hash.slice(-6)} · {copiedHash === item.hash ? "COPIED" : "COPY HASH"}</button>}</div><time>{item.time}</time></article>)}</div>)}
          </section>
)}

          {page === "report" && (
<section className="report-section content-section" id="report">
            <div className="section-heading campaign-heading"><div><span className="section-code">06 / ACCOUNTABILITY</span><h2>Fund Transparency Report</h2><p>Campaign goals, funds raised and contract-recorded fund movements.</p></div><div className="heading-icon"><BarChart3 size={23}/></div></div>
            <div className="report-stats">
              <div className="report-stat"><small>TOTAL CAMPAIGN GOALS</small><strong>{totalGoal.toFixed(4)} ETH</strong></div>
              <div className="report-stat"><small>TOTAL DONATED</small><strong>{donatedEth.toFixed(4)} ETH</strong><span>{transactions.filter(t => t.type === "Donation").length} donation events</span></div>
              <div className="report-stat"><small>TOTAL WITHDRAWN</small><strong>{withdrawnEth.toFixed(4)} ETH</strong><span>{transactions.filter(t => t.type === "Withdrawal").length} withdrawals</span></div>
              <div className="report-stat"><small>TOTAL REFUNDED</small><strong>{refundedEth.toFixed(4)} ETH</strong><span>{transactions.filter(t => t.type === "Refund").length} refunds</span></div>
            </div>
            <article className="report-chart-card daily-donation-card">
              <div className="report-chart-title"><span>DAILY DONATIONS · LAST 7 DAYS</span><strong>{donatedEth.toFixed(4)} ETH GROSS IN LOADED HISTORY</strong></div>
              <div className="daily-donation-chart">
                {dailyDonationData.map(day => <div className="daily-donation-column" key={day.date} title={`${day.date}: ${day.total.toFixed(6)} ETH`}>
                  <strong>{day.total.toFixed(3)}</strong>
                  <div className="daily-donation-track"><i style={{height:`${day.total ? Math.max(5, day.total / dailyDonationMax * 100) : 0}%`}} /></div>
                  <span>{day.label}</span>
                </div>)}
              </div>
              <p className="chart-caption">Daily totals are grouped by the timestamp of confirmed DonationReceived events in the currently loaded block range.</p>
            </article>
            <div className="report-insight-grid">
              <article className="report-chart-card"><div className="report-chart-title"><span>TOTAL DONATIONS</span><strong>{transactions.filter(t=>t.type === "Donation").length}</strong></div><div className="report-bars">{["Donation","Withdrawal","Refund"].map(type=>{const count=transactions.filter(t=>t.type===type).length;const max=Math.max(1,...["Donation","Withdrawal","Refund"].map(k=>transactions.filter(t=>t.type===k).length));return <div className="report-bar-row" key={type}><span>{type}</span><div><i style={{width:`${count/max*100}%`}}/></div><b>{count}</b></div>})}</div></article>
              <article className="report-chart-card"><div className="report-chart-title"><span>CAMPAIGN FUNDING</span><strong>{totalGoal ? (totalRaised/totalGoal*100).toFixed(1) : "0.0"}%</strong></div><div className="funding-ring" style={{"--funding":`${totalGoal?Math.min(totalRaised/totalGoal*100,100):0}%`}}><div><b>{totalRaised.toFixed(3)}</b><small>ETH RAISED</small></div></div><p className="chart-caption">{totalRaised.toFixed(4)} ETH raised from {totalGoal.toFixed(4)} ETH in combined goals</p></article>
              <article className="report-chart-card report-metric-card"><span>CAMPAIGN SUCCESS RATE</span><strong>{campaignSuccessRate.toFixed(1)}%</strong><small>{completedCampaigns} successful of {campaigns.length} total campaigns</small><div className="mini-progress"><i style={{width:`${campaignSuccessRate}%`}}/></div></article>
              <article className="report-chart-card report-metric-card"><span>REFUNDS ISSUED</span><strong>{transactions.filter(t=>t.type === "Refund").length}</strong><small>{transactions.filter(t=>t.type === "Refund").reduce((sum,t)=>sum+Number(t.amount),0).toFixed(4)} ETH returned to donors</small></article>
            </div>
            <div className="report-table-wrap"><table className="report-table"><thead><tr><th>CAMPAIGN</th><th>GOAL</th><th>RAISED</th><th>PROGRESS</th><th>STATUS</th></tr></thead><tbody>{campaigns.map(c => { const goal = Number(ethers.formatEther(c.goal)); const raised = Number(ethers.formatEther(c.raised)); const pct = goal ? Math.min(raised / goal * 100, 100) : 0; return <tr key={c.id}><td>{c.title}<small>#{c.id}</small></td><td>{goal.toFixed(4)} ETH</td><td>{raised.toFixed(4)} ETH</td><td>{pct.toFixed(1)}%</td><td>{c.withdrawn ? "Withdrawn" : pct >= 100 ? "Goal reached" : Number(c.deadline) * 1000 < Date.now() ? "Expired" : "Active"}</td></tr>; })}</tbody></table></div>
            <p className="report-note">This report is calculated from the connected contract's campaign state and the latest 5,000 blocks of events. It is not an independent audit. Amounts shown are in ETH.</p>
          </section>
)}

          {page === "certificates" && (
          <section className="certificates-section content-section">
            <div className="section-heading campaign-heading"><div><span className="section-code">07 / DONOR RECOGNITION</span><h2>Certificates & Verification</h2><p>Generate a PDF-ready certificate for a confirmed donation or verify its on-chain record.</p></div><div className="heading-icon"><Award size={23}/></div></div>
            <div className="certificate-workspace">
              <div className="certificate-panel">
                <h3><Download size={19}/> Download Donation Certificate</h3>
                <p>Select a confirmed donation transaction from the list below. Use Print / Save as PDF to save the certificate.</p>
                {transactions.filter(tx => tx.type === "Donation").length === 0 ? <div className="empty-state"><Award size={28}/><h3>No donation certificates yet</h3><p>After a confirmed donation, its certificate will appear here.</p></div> : transactions.filter(tx => tx.type === "Donation").map(tx => <div className="certificate-row" key={tx.id}><div><strong>{tx.campaignTitle}</strong><small>{tx.amount} ETH · {tx.wallet.slice(0,8)}...{tx.wallet.slice(-6)}</small></div><button className="certificate-action" onClick={() => downloadCertificate(tx)}><Download size={14}/> Download</button></div>)}
              </div>
              <div className="certificate-panel verify-panel">
                <h3><ShieldCheck size={19}/> Verify Donation</h3>
                <p>Use the transaction hash to locate its confirmed record in the loaded blockchain history.</p>
                <input className="verify-input" value={verificationHash} onChange={e => { setVerificationHash(e.target.value); setVerificationResult(null); }} placeholder="Paste donation transaction hash (0x...)" />
                
  <button
  type="button"
  className="primary-btn"
  onClick={() => verifyTransaction()}
  disabled={transactionsLoading || !verificationHash.trim()}
>
  <ShieldCheck size={16} />
  VERIFY TRANSACTION
</button>

                {new URLSearchParams(location.search).get("certificate") && <div className="certificate-id-banner">CERTIFICATE ID · {new URLSearchParams(location.search).get("certificate")}</div>}
                {verificationResult && <div className={`verification-result ${verificationResult.ok ? "verified" : "not-verified"}`}><strong>{verificationResult.ok ? "✓ " : "! "}{verificationResult.title}</strong><p>{verificationResult.detail}</p>{verificationResult.ok && <><small>Donor: {verificationResult.donor}</small><small>Block: {verificationResult.blockNumber} · {verificationResult.date}</small><small className="verification-hash">{verificationResult.hash}</small></>}</div>}
              </div>
            </div>
          </section>
        )}
        {selectedTransaction && <div className="campaign-modal-backdrop" role="presentation" onClick={() => setSelectedTransaction(null)}><section className="campaign-modal transaction-detail-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="campaign-modal-close" onClick={()=>setSelectedTransaction(null)} aria-label="Close transaction details"><X size={20}/></button><span className="section-code">CHARITYCHAIN / ON-CHAIN RECORD</span><h2>Transaction Details</h2><div className="transaction-detail-status"><CheckCircle2 size={17}/> EVENT RECORDED IN LOADED BLOCKCHAIN HISTORY</div><div className="campaign-modal-details"><p><b>Type</b><span>{selectedTransaction.type}</span></p><p><b>Campaign</b><span>{selectedTransaction.campaignTitle} (#{selectedTransaction.campaignId})</span></p><p><b>Wallet</b><span>{selectedTransaction.wallet}</span></p><p><b>Amount</b><span>{selectedTransaction.amount} ETH</span></p><p><b>Block number</b><span>{selectedTransaction.blockNumber}</span></p><p><b>Timestamp</b><span>{selectedTransaction.timestamp?new Date(selectedTransaction.timestamp*1000).toLocaleString():"Unavailable"}</span></p><p><b>Transaction hash</b><span>{selectedTransaction.transactionHash}</span></p></div><div className="campaign-modal-actions"><button className="secondary-btn" onClick={()=>copyHash(selectedTransaction.transactionHash)}><Copy size={15}/>{copiedHash===selectedTransaction.transactionHash?" COPIED":" COPY FULL HASH"}</button>{selectedTransaction.type==="Donation"&&<button className="certificate-btn" onClick={()=>downloadCertificate(selectedTransaction)}><Award size={14}/> CERTIFICATE</button>}</div></section></div>}
        {selectedCampaign && (() => {
          const c = selectedCampaign;
          const goal = Number(ethers.formatEther(c.goal));
          const raised = Number(ethers.formatEther(c.raised));
          const progress = goal > 0 ? Math.min(raised / goal * 100, 100) : 0;
          const expired = Number(c.deadline) * 1000 < clockNow;
          return <div className="campaign-modal-backdrop" role="presentation" onClick={() => setSelectedCampaign(null)}>
            <section className="campaign-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-modal-title" onClick={e => e.stopPropagation()}>
              <button className="campaign-modal-close" onClick={() => setSelectedCampaign(null)} aria-label="Close details"><X size={20}/></button>
              <span className="section-code">CHARITYCHAIN / CAMPAIGN #{c.id}</span>
              <h2 id="campaign-modal-title">{c.title}</h2>
              <p className="campaign-modal-description">{c.description}</p>
              <div className="campaign-modal-stats"><div><small>RAISED</small><strong>{raised.toFixed(4)} ETH</strong></div><div><small>FUNDING GOAL</small><strong>{goal.toFixed(4)} ETH</strong></div><div><small>PROGRESS</small><strong>{progress.toFixed(1)}%</strong></div></div>
              <div className="progress-bar"><div style={{width:`${progress}%`}}/></div>
              <div className="campaign-modal-details"><p><b>Campaign ID</b><span>#{c.id}</span></p><p><b>Creator</b><span>{c.creator}</span></p><p><b>Beneficiary</b><span>{c.beneficiary}</span></p><p><b>Deadline</b><span>{new Date(Number(c.deadline)*1000).toLocaleString()} · {expired ? "Expired" : `${Math.floor((Number(c.deadline)*1000-clockNow)/3600000)} hours remaining`}</span></p><p><b>Status</b><span>{c.withdrawn ? "Funds withdrawn" : progress >= 100 ? "Goal reached" : expired ? "Expired" : "Accepting donations"}</span></p></div>
              <div className="campaign-history"><h3><TrendingUp size={16}/> CAMPAIGN ACTIVITY TIMELINE</h3>{transactions.filter(tx=>tx.campaignId === c.id).length ? transactions.filter(tx=>tx.campaignId === c.id).slice(0,12).map(tx=><div className="campaign-history-row" key={tx.id}><span>{tx.type} · {tx.wallet.slice(0,8)}...{tx.wallet.slice(-5)}</span><b>{tx.amount} ETH</b><small>{tx.timestamp?new Date(tx.timestamp*1000).toLocaleString():`Block ${tx.blockNumber}`}</small><button className="campaign-history-hash" onClick={() => copyHash(tx.transactionHash)}>{copiedHash === tx.transactionHash ? "COPIED" : `${tx.transactionHash.slice(0,10)}…${tx.transactionHash.slice(-6)} · COPY HASH`}</button></div>) : <p>No donation or fund movement events are available in the currently loaded block history.</p>}</div>
              <div className="campaign-modal-actions">{!c.withdrawn && progress < 100 && !expired && <button className="donate-btn" onClick={() => { setSelectedCampaign(null); donate(c.id); }}><Heart size={15}/> DONATE TO THIS CAMPAIGN</button>}{!c.withdrawn && progress < 100 && expired && <button className="refund-btn" onClick={() => { setSelectedCampaign(null); refund(c.id); }}>CLAIM REFUND</button>}<button className="secondary-btn" onClick={() => { setSelectedCampaign(null); navigateTo("transactions"); }}>VIEW TRANSACTIONS <ArrowUpRight size={14}/></button></div>
            </section>
          </div>;
        })()}
        <footer className="site-footer"><div className="footer-brand"><span className="brand-mark"><Heart size={17} /></span> CHARITY<span className="brand-accent">CHAIN</span></div><p>Powered by Ethereum Smart Contracts</p><span>© 2026 CHARITYCHAIN / BLOCKCHAIN PROJECT</span></footer>
        </div>
      </main>
    </div>
  );
}

export default function CharityChainRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  );
}