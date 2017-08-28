const Web3 = require("web3");
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

const liquidpledging = require('liquidpledging');
const LiquidPledging = liquidpledging.LiquidPledging(true)  // bool for yes testing env
const Vault = liquidpledging.Vault;


async function run() {
  // setting up vault and liquid pledging is as easy as 1, 2, 3
  // 1) instantiate and connect vault to blockchain network
  const vault = await Vault.new(web3);
  // 2) instantiate and connect liquidPledging to blockchain network
  //    and set liquidPledging to use vault address
  const liquidPledging = await LiquidPledging.new(web3, vault.$address);
  // 3) set vault to authorize liquidPledging address
  await vault.setLiquidPledging(liquidPledging.$address);

  // now let's play
  // note that hardcoded addresses were copy/pasted from using "testrpc --deterministic"
  // as blockchain test network

  // create 1st donor, addDonor(name, time_before_committed, controller address of this donor)
  const donor1 = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';
  await liquidPledging.addDonor('Donor1', 86400, { from: donor1 });
  // create 2nd donor, also has delay of 1 day (86400 seconds) before committing
  // this is the time funds will be pre-committed
  const donor2 = '0xffcf8fdee72ac11b5c542428b35eef5769c409f0';
  await liquidPledging.addDonor('Donor2', 86400, { from: donor2 });

  // create 1st note, donate to donor1 from donor1
  await liquidPledging.donate(1, 1, { from: donor1, value: 10 });
  // create 2nd note, donate to donor2 from donor1
  await liquidPledging.donate(1, 2, { from: donor1, value: 20 });

  // log state of system to see notes and donors
  const st1 = await liquidPledging.getState();
  console.log(JSON.stringify(st1, null, 2))

  // create delegate (3rd controller address), no commitment time delay necessary
  const delegate1 = '0x22d491bde2303f2f43325b2108d26f1eaba1e32b';
  await liquidPledging.addDelegate('Delegate1', { from: delegate1 });

  // transfer from donor1, 1st note, 5eth, 3rd controller, from donor1 address
  // this creates 3rd note (a bit weird)
  await liquidPledging.transfer(1, 1, 5, 3, { from: donor1 });

  // create project (4th controller) with its own address
  // projects are kinda like a milestones
  // addProject(name, canceler address, parent project 0, pre-committed time, from owner address)
  const projectOwner1 = '0xe11ba2b4d45eaed5996cd0823791e0c93114882d';
  await liquidPledging.addProject('Project1', projectOwner1, 0, 86400, { from: projectOwner1 });

  // transfer from delegate1 (3rd controller), 3th note, 5eth, 4th controller, extra gas, from owner of note address (i think)
  await liquidPledging.transfer(3, 3, 5, 4, { $extraGas: 200000, $verbose: true }, { from: delegate1 });

  // create subproject (like a submilestone)
  // probably not useful for Giveth but certainly for blockchains.com
  const subproject1 = '0xd03ea8624c8c5987235048901fb614fdca89b117';
  await liquidPledging.addProject('SubProject1', subproject1, 4, 86400, { from: projectOwner1 });

  // in test mode, see line: const LiquidPledging = liquidpledging.LiquidPledging(true)  // bool for yes testing env
  // we can skip time ahead into future to test pass commitment delays
  const n = Math.floor(new Date().getTime() / 1000);
  await liquidPledging.setMockedTime(n + (86401 * 3));  // skip ahead 3 days and 3 secs

  // after 3 days, donor1 can no longer transfer his funds back from funds delegated to project (4th note)
  try {
    await liquidPledging.transfer(1, 4, 5, 1, { $extraGas: 200000, $verbose: true }, { from: donor1 });
    console.log("IT DIDN'T THROWED");
  } catch(err) {
    console.log("IT THROWED");
  }

  // log state of system
  const st5 = await liquidPledging.getState();
  console.log(JSON.stringify(st5, null, 2))


  // more stuff need to commitment...
  
  await liquidPledging.transfer(4, 4, 1, 5, { $extraGas: 200000, $verbose: true }, { from: projectOwner1 });

  console.log("hello2")
  await liquidPledging.cancelProject(5, { from: subproject1 });

  console.log("hello3")

  await liquidPledging.withdraw(6, 1, { $gas: 3000000, $verbose: true }, { from: projectOwner1 });
  await vault.confirmPayment(0);

  const st = await liquidPledging.getState();
  console.log(JSON.stringify(st, null, 2))

  await liquidPledging.withdraw(4, 4, { $gas: 3000000, $verbose: true }, { from: projectOwner1 });
  await vault.confirmPayment(1);

  const st2 = await liquidPledging.getState();
  console.log(JSON.stringify(st2, null, 2))

}

run()
