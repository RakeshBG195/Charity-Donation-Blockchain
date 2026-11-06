import { useState } from "react";
import { ethers } from "ethers";
import { getCharityContract } from "./blockchain/contract";
import {
  Heart, Wallet, ShieldCheck, PlusCircle, RefreshCw, HandHeart, Clock,
  Coins, LayoutDashboard, Activity, ArrowUpRight, Zap, CircleDollarSign,
  Menu, X
} from "lucide-react";
import "./App.css";

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");

  const [form, setForm] = useState({
    title: "",
    description: "",
    beneficiary: "",
    goal: "",
    duration: "30",
  });

  async function connectWallet() {
    try {
      setMessage("Connecting wallet...");
      const charity = await getCharityContract();
      const signerAddress = await charity.runner.getAddress();

      setContract(charity);
      setAccount(signerAddress);
      setMessage("Wallet connected successfully!");
      await loadCampaigns(charity);
    } catch (error) {
      setMessage(error.shortMessage || error.message || "Wallet connection failed.");
    }
  }

  async function loadCampaigns(activeContract = contract) {
    if (!activeContract) {
      setMessage("Connect your wallet first.");
      return;
    }

    try {
      setLoading(true);
      const count = await activeContract.campaignCount();
      const results = [];

      for (let i = 1n; i <= count; i++) {
        const c = await activeContract.getCampaignDetails(i);
        results.push({
          id: c.id.toString(),
          title: c.title,
          description: c.description,
          creator: c.creator,
          beneficiary: c.beneficiary,
          goal: c.goal,
          raised: c.raised,
          deadline: c.deadline,
          withdrawn: c.withdrawn,
        });
      }

      setCampaigns(results.reverse());
    } catch (error) {
      setMessage(error.shortMessage || error.message || "Unable to load campaigns.");
    } finally {
      setLoading(false);
    }
  }

  async function createCampaign(e) {
    e.preventDefault();

    if (!contract) {
      setMessage("Please connect your wallet first.");
      return;
    }

    try {
      if (!form.title.trim() || !form.description.trim()) {
        throw new Error("Enter a campaign title and description.");
      }
      if (!ethers.isAddress(form.beneficiary)) {
        throw new Error("Please enter a valid beneficiary wallet address.");
      }
      if (!Number.isFinite(Number(form.goal)) || Number(form.goal) <= 0) {
        throw new Error("Enter a valid campaign goal.");
      }
      if (!Number.isInteger(Number(form.duration)) || Number(form.duration) <= 0) {
        throw new Error("Enter a valid duration in days.");
      }

      setLoading(true);
      setMessage("Waiting for campaign transaction...");

      const tx = await contract.createCampaign(
        form.title,
        form.description,
        form.beneficiary,
        ethers.parseEther(form.goal),
        Number(form.duration)
      );

      await tx.wait();
      setMessage("Campaign created successfully!");
      setForm({
        title: "",
        description: "",
        beneficiary: "",
        goal: "",
        duration: "30",
      });

      await loadCampaigns();
    } catch (error) {
      setMessage(error.reason || error.shortMessage || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function donate(id) {
    if (!contract) {
      setMessage("Connect your wallet first.");
      return;
    }

    const amount = window.prompt("Enter donation amount in ETH:");
    if (!amount) return;

    try {
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        throw new Error("Enter a valid donation amount.");
      }

      setLoading(true);
      setMessage("Waiting for donation confirmation...");

      const tx = await contract.donate(id, {
        value: ethers.parseEther(amount),
      });

      await tx.wait();
      setMessage("Donation successful!");
      await loadCampaigns();
    } catch (error) {
      setMessage(error.reason || error.shortMessage || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function withdraw(id) {
    if (!contract) return;

    try {
      setLoading(true);
      setMessage("Processing withdrawal...");

      const tx = await contract.withdrawFunds(id);
      await tx.wait();

      setMessage("Funds withdrawn successfully!");
      await loadCampaigns();
    } catch (error) {
      setMessage(error.reason || error.shortMessage || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function refund(id) {
    if (!contract) return;

    try {
      setLoading(true);
      setMessage("Processing refund...");

      const tx = await contract.claimRefund(id);
      await tx.wait();

      setMessage("Refund claimed successfully!");
      await loadCampaigns();
    } catch (error) {
      setMessage(error.reason || error.shortMessage || error.message);
    } finally {
      setLoading(false);
    }
  }

  const totalRaised = campaigns.reduce(
    (sum, campaign) => sum + Number(ethers.formatEther(campaign.raised)),
    0
  );

  const totalGoal = campaigns.reduce(
    (sum, campaign) => sum + Number(ethers.formatEther(campaign.goal)),
    0
  );

  const completedCampaigns = campaigns.filter(
    campaign => Number(campaign.raised) >= Number(campaign.goal)
  ).length;

  function navigateTo(section) {
    setActiveSection(section);
    setMobileMenu(false);
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <a
          href="#dashboard"
          className="brand"
          onClick={() => navigateTo("dashboard")}
        >
          <span className="brand-icon"><Heart size={22} /></span>
          <span>CHARITY<span className="brand-highlight">CHAIN</span></span>
        </a>

        <div className="sidebar-label">MAIN MENU</div>

        <nav className="sidebar-nav">
          <button
            className={`side-link ${activeSection === "dashboard" ? "active" : ""}`}
            onClick={() => navigateTo("dashboard")}
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </button>

          <button
            className={`side-link ${activeSection === "create" ? "active" : ""}`}
            onClick={() => navigateTo("create")}
          >
            <PlusCircle size={19} />
            <span>Create Campaign</span>
          </button>

          <button
            className={`side-link ${activeSection === "campaigns" ? "active" : ""}`}
            onClick={() => navigateTo("campaigns")}
          >
            <Activity size={19} />
            <span>Campaigns</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-network">
            <span className="online-dot" />
            <div>
              <strong>HARDHAT NETWORK</strong>
              <small>Local blockchain</small>
            </div>
          </div>

          <div className="sidebar-note">
            <ShieldCheck size={17} />
            <span>Transparent. Secure. Decentralized.</span>
          </div>
        </div>
      </aside>

      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMobileMenu(false)}
          aria-label="Close sidebar"
        />
      )}

      <div className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Toggle sidebar"
          >
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="topbar-title">
            <span className="topbar-kicker">CHARITY ECOSYSTEM</span>
            <strong>
              {activeSection === "create"
                ? "Create Campaign"
                : activeSection === "campaigns"
                ? "Explore Campaigns"
                : "Overview Dashboard"}
            </strong>
          </div>

          <button
            className="connect-btn"
            onClick={connectWallet}
            disabled={loading}
          >
            <Wallet size={18} />
            {account
              ? `${account.slice(0, 6)}...${account.slice(-4)}`
              : "Connect Wallet"}
          </button>
        </header>

        <main className="content">
          {message && (
            <div className="message">
              <span>{message}</span>
              <button onClick={() => setMessage("")} aria-label="Dismiss message">
                ×
              </button>
            </div>
          )}

          <section className="hero" id="dashboard">
            <div className="hero-content">
              <div className="eyebrow">
                <Zap size={14} />
                DECENTRALIZED CHARITY ECOSYSTEM
              </div>

              <h1>Make Every Donation <span>Count.</span></h1>

              <p>
                A transparent donation ecosystem powered by blockchain
                technology. Every contribution is recorded securely on the
                blockchain.
              </p>

              <div className="hero-buttons">
                <button
                  className="primary-btn"
                  onClick={() => navigateTo("campaigns")}
                >
                  Explore Campaigns <ArrowUpRight size={18} />
                </button>

                <button
                  className="secondary-btn"
                  onClick={() => navigateTo("create")}
                >
                  <PlusCircle size={18} />
                  Start a Campaign
                </button>
              </div>

              <div className="hero-trust">
                <ShieldCheck size={17} />
                Transparent. Secure. Decentralized.
              </div>
            </div>

            <div className="hero-art">
              <div className="hero-circle"><HandHeart size={100} /></div>
              <div className="floating-heart"><Heart /></div>
              <div className="floating-shield"><ShieldCheck /></div>
              <div className="floating-zap"><Zap /></div>
            </div>
          </section>

          <section className="stats">
            <article className="stat-card">
              <div className="stat-icon"><HandHeart /></div>
              <div>
                <p>Total Campaigns</p>
                <h2>{campaigns.length}</h2>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-icon"><Coins /></div>
              <div>
                <p>Total Donations</p>
                <h2>{totalRaised.toFixed(4)} ETH</h2>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-icon"><ShieldCheck /></div>
              <div>
                <p>Completed Campaigns</p>
                <h2>{completedCampaigns}</h2>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-icon"><CircleDollarSign /></div>
              <div>
                <p>Total Campaign Goals</p>
                <h2>{totalGoal.toFixed(2)} ETH</h2>
              </div>
            </article>
          </section>

          <section className="create-section" id="create">
            <div className="section-heading">
              <div>
                <span className="eyebrow">START SOMETHING GOOD</span>
                <h2>Create a Campaign</h2>
              </div>
              <PlusCircle size={30} />
            </div>

            <form className="campaign-form" onSubmit={createCampaign}>
              <label htmlFor="campaign-title">Campaign Title</label>
              <input
                id="campaign-title"
                placeholder="Enter campaign title"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                required
              />

              <label htmlFor="campaign-description">Campaign Description</label>
              <textarea
                id="campaign-description"
                placeholder="Describe your charity campaign"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                required
              />

              <label htmlFor="beneficiary">Beneficiary Wallet Address</label>
              <input
                id="beneficiary"
                placeholder="0x..."
                value={form.beneficiary}
                onChange={e => setForm({ ...form, beneficiary: e.target.value })}
                required
              />

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="goal">Goal Amount (ETH)</label>
                  <input
                    id="goal"
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="5 ETH"
                    value={form.goal}
                    onChange={e => setForm({ ...form, goal: e.target.value })}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="duration">Duration (Days)</label>
                  <input
                    id="duration"
                    type="number"
                    min="1"
                    placeholder="30 days"
                    value={form.duration}
                    onChange={e => setForm({ ...form, duration: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button className="primary-btn" disabled={loading || !contract}>
                <PlusCircle size={18} />
                {loading ? "Processing..." : "Create Campaign"}
              </button>

              {!contract && (
                <p className="form-note">
                  Connect your MetaMask wallet before creating a campaign.
                </p>
              )}
            </form>
          </section>

          <section className="campaign-section" id="campaigns">
            <div className="section-heading">
              <div>
                <span className="eyebrow">SUPPORT A CAUSE</span>
                <h2>Explore Campaigns</h2>
              </div>

              <button
                className="refresh-btn"
                onClick={() => loadCampaigns()}
                disabled={!contract || loading}
              >
                <RefreshCw size={17} />
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {!account && (
              <div className="empty-state">
                <Wallet size={35} />
                <h3>Connect Your Wallet</h3>
                <p>
                  Connect MetaMask to view and interact with blockchain campaigns.
                </p>
              </div>
            )}

            {account && campaigns.length === 0 && (
              <div className="empty-state">
                <HandHeart size={35} />
                <h3>No Campaigns Found</h3>
                <p>Create the first charity campaign on CharityChain.</p>
              </div>
            )}

            <div className="campaign-grid">
              {campaigns.map(campaign => {
                const goal = Number(ethers.formatEther(campaign.goal));
                const raised = Number(ethers.formatEther(campaign.raised));
                const progress = goal > 0
                  ? Math.min((raised / goal) * 100, 100)
                  : 0;
                const expired = Number(campaign.deadline) * 1000 < Date.now();
                const completed = raised >= goal;
                const isBeneficiary =
                  account.toLowerCase() === campaign.beneficiary.toLowerCase();

                return (
                  <article className="campaign-card" key={campaign.id}>
                    <div className="campaign-card-top">
                      <span className="campaign-tag">
                        CAMPAIGN #{campaign.id}
                      </span>
                      <Heart size={20} />
                    </div>

                    <h3>{campaign.title}</h3>
                    <p>{campaign.description}</p>

                    <div className="progress-info">
                      <span>{raised.toFixed(4)} ETH raised</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>

                    <div className="progress-bar">
                      <div style={{ width: `${progress}%` }} />
                    </div>

                    <div className="goal-info">
                      <span>Goal: {goal} ETH</span>
                      <span>
                        <Clock size={14} />
                        {expired ? "Expired" : "Active"}
                      </span>
                    </div>

                    {!campaign.withdrawn && !completed && !expired && (
                      <button
                        className="donate-btn"
                        onClick={() => donate(campaign.id)}
                        disabled={loading}
                      >
                        <Heart size={17} />
                        Donate Now
                      </button>
                    )}

                    {!campaign.withdrawn && completed && isBeneficiary && (
                      <button
                        className="donate-btn"
                        onClick={() => withdraw(campaign.id)}
                        disabled={loading}
                      >
                        <Coins size={17} />
                        Withdraw Funds
                      </button>
                    )}

                    {!campaign.withdrawn && completed && !isBeneficiary && (
                      <span className="completed-label">
                        Funding Goal Reached
                      </span>
                    )}

                    {!completed && expired && (
                      <button
                        className="refund-btn"
                        onClick={() => refund(campaign.id)}
                        disabled={loading}
                      >
                        Claim My Refund
                      </button>
                    )}

                    {campaign.withdrawn && (
                      <span className="completed-label">Funds Withdrawn</span>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <footer>
            <div className="brand">
              <span className="brand-icon"><Heart /></span>
              <span>CHARITY<span className="brand-highlight">CHAIN</span></span>
            </div>
            <p>Powered by Ethereum Smart Contracts</p>
            <p>© 2026 CharityChain | Blockchain Project</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
