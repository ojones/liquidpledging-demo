const Web3 = require("web3");

// test blockchain network started in seperate terminal using: testrpc --deterministic
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

const liquidpledging = require('liquidpledging');
const LiquidPledging = liquidpledging.LiquidPledging(true)  // bool for yes testing env
const Vault = liquidpledging.Vault;

// these are the available accounts I get from running testrpc --deterministic
// probably different for you
const availableAccounts = [
  '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
  '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
  '0x22d491bde2303f2f43325b2108d26f1eaba1e32b',
  '0xe11ba2b4d45eaed5996cd0823791e0c93114882d',
  '0xd03ea8624c8c5987235048901fb614fdca89b117',
  '0x95ced938f7991cd0dfcb48f0a06a40fa1af46ebc',
  '0x3e5e9111ae8eb78fe1cc3bb8915d5d461f3ef9a9',
  '0x28a8746e75304c0780e011bed21c72cd78cd535e',
  '0xaca94ef8bd5ffee41947b4585a84bda5a3d3da6e',
  '0x1df62f291b2e969fb0849d99d9ce41e2f137006e'
];

const logNumManagersAndNotes = (state) => {
  console.log("    num_managers:", state.managers.length, ",", "num_notes:", state.notes.length)
}

const logNoteAmounts = (state) => {
  amounts = []
  state.notes.forEach((c, i, a) => {
    if (a[i]) {
      amounts.push(a[i].amount.toNumber())
    }
  })
  console.log("    amounts in each note:", amounts.join(", "))
};

// run demo script
async function run() {
  // setting up vault and liquid pledging is as easy as 1, 2, 3
  // 1) instantiate and connect vault to blockchain network
  const vault = await Vault.new(web3);
  // 2) instantiate and connect liquidPledging to blockchain network
  //    and set liquidPledging to use vault address
  const liquidPledging = await LiquidPledging.new(web3, vault.$address);
  // 3) set vault to authorize liquidPledging address
  await vault.setLiquidPledging(liquidPledging.$address);

  // use state to retrieve and hold state of managers and notes
  let state = await liquidPledging.getState();
  console.log("\nthis what it looks like in the beginning")
  console.log("notice how both arrays for notes and managers start with 1 null value")
  console.log(JSON.stringify(state, null, 2))

  // log number of managers and notes
  state = await liquidPledging.getState();
  logNumManagersAndNotes(state)

  // now let's play
  // note that hardcoded addresses were copy/pasted from using "testrpc --deterministic"
  // as blockchain test network

  console.log("\nlet's create 2 donors")
  // create 1st donor, addDonor(name, time_before_committed, controller address of this donor)
  const donor1 = availableAccounts[1];
  await liquidPledging.addDonor('Donor1', 86400, { from: donor1 });
  // create 2nd donor, also has delay of 1 day (86400 seconds) before committing
  // this is the time funds will be pre-committed
  const donor2 = availableAccounts[2];
  await liquidPledging.addDonor('Donor2', 86400, { from: donor2 });

  // log number of managers and notes
  state = await liquidPledging.getState();
  logNumManagersAndNotes(state)

  console.log("\nlet's donate to each of them from donor1")
  // create 1st note, donate 10 wei to donor1 from donor1
  await liquidPledging.donate(1, 1, { from: donor1, value: 10 });
  // create 2nd note, donate 20 wei to donor2 from donor1
  await liquidPledging.donate(1, 2, { from: donor1, value: 20 });

  // log number of managers and notes
  state = await liquidPledging.getState();
  logNoteAmounts(state)

  console.log("\nlet's create a delegate and transfer him 5 wei from donor1")
  // create delegate (3rd controller address), no commitment time delay necessary
  const delegate1 = availableAccounts[3];
  await liquidPledging.addDelegate('Delegate1', { from: delegate1 });
  // transfer from donor1, 1st note, 5 wei, 3rd controller, from donor1 address
  // this creates 3rd note (a bit weird)
  await liquidPledging.transfer(1, 1, 5, 3, { from: donor1 });

  // log number of managers and notes
  state = await liquidPledging.getState();
  logNumManagersAndNotes(state)
  logNoteAmounts(state)

  console.log("\nlet's create a project and have the delegate transfer the 5 wei")
  // create project (4th controller) with its own address
  // projects are kinda like a milestones
  // addProject(name, canceler address, parent project 0, pre-committed time, from owner address)
  const projectOwner1 = availableAccounts[4];
  await liquidPledging.addProject('Project1', projectOwner1, 0, 86400, { from: projectOwner1 });

  // transfer from delegate1 (3rd controller), 3th note, 5 wei, 4th controller, extra gas, from owner of note address (i think)
  await liquidPledging.transfer(3, 3, 5, 4, { $extraGas: 200000 }, { from: delegate1 });

  // log number of managers and notes
  state = await liquidPledging.getState();
  logNumManagersAndNotes(state)
  logNoteAmounts(state)

  console.log("\nlet's have the project create a subproject and transfer the 1 wei")
  // create subproject (5th controller)
  // this is how a campaign might create a milestone
  const subproject1 = availableAccounts[5];
  await liquidPledging.addProject('SubProject1', subproject1, 4, 86400, { from: projectOwner1 });

  // in test mode, see line: const LiquidPledging = liquidpledging.LiquidPledging(true)  // bool for yes testing env
  // we can skip time ahead into future to test pass commitment delays
  const n = Math.floor(new Date().getTime() / 1000);
  await liquidPledging.setMockedTime(n + (86401 * 3));  // skip ahead 3 days and 3 secs

  // after 3 days, donor1 can no longer transfer his funds back from funds delegated to project (4th note)
  try {
    await liquidPledging.transfer(1, 4, 5, 1, { $extraGas: 200000 }, { from: donor1 });
    console.log("    transfer succeeded");
  } catch(err) {
    console.log("    error on transfer as expected");
  }

  // transfer (creates 5th note) from 4th controller, 4th note, 1 wei, 5th controller, from sender address
  await liquidPledging.transfer(4, 4, 1, 5, { $extraGas: 200000 }, { from: projectOwner1 });

  // log number of managers and notes
  state = await liquidPledging.getState();
  logNumManagersAndNotes(state)
  logNoteAmounts(state)

  console.log("\nlet's cancel project")
  // cancel project stops the 5th controller from ability to send funds and creates 6th note
  await liquidPledging.cancelProject(5, { from: subproject1 });

  // log number of managers and notes
  state = await liquidPledging.getState();
  logNumManagersAndNotes(state)
  logNoteAmounts(state)

  console.log("\nlet's withdraw 1 wei and confirm payment on vault")
  // withdraw from 6th note, 1 wei, from sender address
  await liquidPledging.withdraw(6, 1, { $gas: 3000000 }, { from: projectOwner1 });
  // vault must confirm payment
  await vault.confirmPayment(0);

  // log number of managers and notes
  state = await liquidPledging.getState();
  logNumManagersAndNotes(state)
  logNoteAmounts(state)

  console.log("\nlet's withdraw 4 wei and confirm payment on vault")
  // withdraw from 4th note, 4 wei, from sender address
  await liquidPledging.withdraw(4, 4, { $gas: 3000000 }, { from: projectOwner1 });
  await vault.confirmPayment(1);

  // log number of managers and notes
  state = await liquidPledging.getState();
  logNumManagersAndNotes(state)
  logNoteAmounts(state)
}

// run demo script
run()
