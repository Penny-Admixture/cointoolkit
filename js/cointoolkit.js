$(document).ready(function() {

	if(window.location.hostname == "ttutdxh-nubits.github.io" && window.location.protocol != 'https:') {
		window.location.href = "https:" + window.location.href.substring(window.location.protocol.length);
	}

	var toolkit = {};

	var wallet_timer = false;
	function updateQueryStringParameter(uri, key, value) {
		var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
		var separator = uri.indexOf('?') !== -1 ? "&" : "?";
		if (uri.match(re)) {
			return uri.replace(re, '$1' + key + "=" + value + '$2');
		}
		else {
			return uri + separator + key + "=" + value;
		}
	}

	function walletBalance(){
		var tx = coinjs.transaction();
		$("#walletLoader").removeClass("hidden");
		coinjs.addressBalance($("#walletAddress").html(),function(data){
			if($(data).find("result").text()==1){
				var v = $(data).find("balance").text()/("1e"+coinjs.decimalPlaces);
				$("#walletBalance").html(v+" BTC").attr('rel',v).fadeOut().fadeIn();
			} else {
				$("#walletBalance").html("0.00 BTC").attr('rel',v).fadeOut().fadeIn();
			}

			$("#walletLoader").addClass("hidden");
		});
	}

	function checkBalanceLoop(){
		clearTimeout(wallet_timer);
		wallet_timer = setTimeout(function(){
			if($("#walletLoader").hasClass("hidden")){
				walletBalance();
			}
			checkBalanceLoop();
		},45000);
	}

	function scannerStart(){
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || false;
		if(navigator.getUserMedia){
			if (!!window.stream) {
				$("video").attr('src',null);
				window.stream.stop();
			}

			var videoSource = $("select#videoSource").val();
			var constraints = {
				video: {
					optional: [{sourceId: videoSource}]
				}
			};

			navigator.getUserMedia(constraints, function(stream){
				window.stream = stream; // make stream available to console
				var videoElement = document.querySelector('video');
				videoElement.src = window.URL.createObjectURL(stream);
				videoElement.play();
			}, function(error){ });

			QCodeDecoder().decodeFromCamera(document.getElementById('videoReader'), function(er,data){
				if(!er){
					var match = data.match(/^(bitcoin|ppcoin|peercoin)\:([a-z0-9]{27,34})/i);
					var result = match ? match[2] : data;
					$(""+$("#qrcode-scanner-callback-to").html()).val(result);
					$("#qrScanClose").click();
				}
			});
		} else {
			$("#videoReaderError").removeClass("hidden");
			$("#videoReader, #videoSource").addClass("hidden");
		}
	}

	/* function to determine what we are redeeming from */
	function redeemingFrom(string){
		var r = {};
		var decode = coinjs.addressDecode(string);
		if(decode.version == coinjs.pub){ // regular address
			r.addr = string;
			r.from = 'address';
			r.redeemscript = false;
		} else if (decode.version == coinjs.priv){ // wif key
			var a = coinjs.wif2address(string);
			r.addr = a['address'];
			r.from = 'wif';
			r.redeemscript = false;
		} else if (decode.version == coinjs.multisig){ // mulisig address
			r.addr = '';
			r.from = 'multisigAddress';
			r.redeemscript = false;
		} else if(decode.type == 'bech32'){
			r.addr = string;
			r.from = 'bech32';
			r.decodedRs = decode.redeemscript;
			r.redeemscript = true;
		} else {
			var script = coinjs.script();
			var decodeRs = script.decodeRedeemScript(string);
			if(decodeRs){ // redeem script
				r.addr = decodeRs['address'];
				r.from = 'redeemScript';
				r.decodedRs = decodeRs.redeemscript;
				r.type = decodeRs['type'];
				r.redeemscript = true;
				r.decodescript = decodeRs;
			} else { // something else
				r.addr = '';
				r.from = 'other';
				r.redeemscript = false;
			}
		}
		return r;
	}

	/* global function to add outputs to page */
	function addOutput(tx, n, script, amount) {
		if(tx){
			if($("#inputs .txId:last").val()!=""){
				$("#inputs .txidAdd:last").click();
			}

			$("#inputs .row:last input").attr('disabled',true);

			$("#inputs .txId:last").val(tx);
			$("#inputs .txIdN:last").val(n);
			$("#inputs .txIdAmount:last").val(amount);

			if(((script.match(/^00/) && script.length==44)) || (script.length==40 && script.match(/^[a-f0-9]+$/gi))){
				s = coinjs.script();
				s.writeBytes(Crypto.util.hexToBytes(script));
				s.writeOp(0);
				s.writeBytes(coinjs.numToBytes((amount*("1e"+coinjs.decimalPlaces)).toFixed(0), 8));
				script = Crypto.util.bytesToHex(s.buffer);
			}

			$("#inputs .txIdScript:last").val(script);
		}
	}

	/* math to calculate the inputs and outputs */

	function totalInputAmount(){
		$("#totalInput").html('0.00');
		$.each($("#inputs .txIdAmount"), function(i,o){
			if(isNaN($(o).val())){
				$(o).parent().addClass('has-error');
			} else {
				$(o).parent().removeClass('has-error');
				var f = 0;
				if(!isNaN($(o).val())){
					f += $(o).val()*1;
				}
				$("#totalInput").html((($("#totalInput").html()*1) + (f*1)).toFixed(coinjs.decimalPlaces));
			}
		});
		totalFee();
	}

	function validateOutputAmount(){
		$("#recipients .amount").unbind('');
		$("#recipients .amount").keyup(function(){
			if(isNaN($(this).val())){
				$(this).parent().addClass('has-error');
			} else {
				$(this).parent().removeClass('has-error');
				var f = 0;
				$.each($("#recipients .amount"),function(i,o){
					if(!isNaN($(o).val())){
						f += $(o).val()*1;
					}
				});
				$("#totalOutput").html((f).toFixed(coinjs.decimalPlaces));
			}
			totalFee();
		}).keyup();
	}

	function totalFee(){
		var fee = (($("#totalInput").html()*1) - ($("#totalOutput").html()*1)).toFixed(coinjs.decimalPlaces);
		$("#transactionFee").val((fee>0)?fee:'0.00');
	}

	function decodeRedeemScript(){
		var script = coinjs.script();
		var decode = script.decodeRedeemScript($("#verifyScript").val());
		if(decode){
			$("#verifyRsData .multisigAddress").val(decode['address']);
			$("#verifyRsData .multisigScriptHash").val(decode['scriptHash']);
			$("#verifyRsData .multisigScriptHashKnown").val((known.scriptHash[decode['scriptHash']])?known.scriptHash[decode['scriptHash']].name:'');
			$("#verifyRsData .signaturesRequired").html(decode['signaturesRequired']);
			$("#verifyRsData table tbody").html("");
			$("#verifyRsDataMultisig").addClass('hidden');
			$("#verifyRsDataHodl").addClass('hidden');
			$("#verifyRsDataSegWit").addClass('hidden');
			$("#verifyRsData").addClass("hidden");


			if(decode.type == "multisig__") {
				$("#verifyRsDataMultisig .multisigAddress").val(decode['address']);
				$("#verifyRsDataMultisig .signaturesRequired").html(decode['signaturesRequired']);
				$("#verifyRsDataMultisig table tbody").html("");
				for(var i=0;i<decode.pubkeys.length;i++){
					var pubkey = decode.pubkeys[i];
					
					identity = "";
					if (known.pubKey[pubkey]) {
						identity = known.pubKey[pubkey].name;
					}
					
					var address = coinjs.pubkey2address(pubkey);
					$('<tr><td width="30%"><input type="text" class="form-control" value="'+address+'" readonly></td><td><input type="text" class="form-control" value="'+pubkey+'" readonly></td><td><input type="text" class="form-control" value="'+identity+'" readonly></td></tr>').appendTo("#verifyRsDataMultisig table tbody");
				}
				$("#verifyRsData").removeClass("hidden");
				$("#verify .verifyLink").val(document.location.origin+''+document.location.pathname+'?mode='+$("#coinSelector").val()+'&verify='+$("#verifyScript").val());
				history.pushState({}, null, $("#verify .verifyLink").val());
				$("#verifyRsDataMultisig").removeClass('hidden');
				$(".verifyLink").attr('href','?verify='+$("#verifyScript").val());
				return true;
			} else if(decode.type == "segwit__"){
				$("#verifyRsData").removeClass("hidden");
				$("#verifyRsDataSegWit .segWitAddress").val(decode['address']);
				$("#verifyRsDataSegWit").removeClass('hidden');
				return true;
			} else if(decode.type == "hodl__") {
				var d = $("#verifyRsDataHodl .date").data("DateTimePicker");
				$("#verifyRsDataHodl .address").val(decode['address']);
				$("#verifyRsDataHodl .pubkey").val(coinjs.pubkey2address(decode['pubkey']));
				$("#verifyRsDataHodl .date").val(decode['checklocktimeverify'] >= 500000000? moment.unix(decode['checklocktimeverify']).format("MM/DD/YYYY HH:mm") : decode['checklocktimeverify']);
				$("#verifyRsData").removeClass("hidden");
				$("#verifyRsDataHodl").removeClass('hidden');
				$(".verifyLink").val(document.location.origin+''+document.location.pathname+'?mode='+$("#coinSelector").val()+'&verify='+$("#verifyScript").val());
				return true;
			}
		}
		return false;
	}

	function decodeTransactionScript(){
		var tx = coinjs.transaction();
		try {
			var decode = tx.deserialize($("#verifyScript").val());
			$("#verifyTransactionData .transactionVersion").html(decode['version']);
			$("#verifyTransactionData .transactionTime").html(new Date(decode['nTime']*1000).toUTCString());
			$("#verifyTransactionData .transactionSize").html(decode.size()+' <i>bytes</i>');
			$("#verifyTransactionData .transactionLockTime").html(decode['lock_time']);
			$("#verifyTransactionData .transactionRBF").hide();
			$("#verifyTransactionData .transactionSegWit").hide();
			if (decode.witness.length>=1) {
				$("#verifyTransactionData .transactionSegWit").show();
			}
			$("#verifyTransactionData .transactionUnit").html(String.fromCharCode(decode['nUnit']));
			$("#verifyTransactionData .verifyToSign").off().on( "click", function() {
				$("#signTransaction").val(decode.serialize()).fadeOut().fadeIn();
				window.location.hash = "#sign";
			});
			$("#verifyTransactionData .verifyToLedgerSign").off().on( "click", function() {
				getLedgerSignatures(decode, 1, function(result) {
					if (result) {
						$("#verifyScript").val(result).fadeOut().fadeIn();
						window.location.hash = "#verify";
						$("#verifyBtn").click();
						}
					else {
						$("#verifyData tbody").html("");
						$("#verify .verifyData").addClass("hidden");
						$("#verifyStatus").removeClass("hidden").html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error during signing. Most likely wrong key used for signing.');
						$("#verifyStatus").show();
						}
					});
			});

			$("#verifyTransactionData .verifyToBroadcast").off().on( "click", function() {
				$("#broadcast #rawTransaction").val(decode.serialize()).fadeOut().fadeIn();
				window.location.hash = "#broadcast";
			});
			$("#verifyTransactionData").removeClass("hidden");
			$("#verifyTransactionData tbody").html("");

			$("#verifyTransactionData .ins tbody").html("");
			$("#verifyTransactionData .fee").addClass("hidden").attr("style", "");

			var inAmountAvailable = 0;
			var amountTotal = 0;
			
			var h = '';
			$.each(decode.ins, function(i,o){
				var s = decode.extractScriptKey(i);
				h = '<tr>';
				h += '<td class="col-xs-7 txid"><input class="form-control" type="text" value="'+o.outpoint.hash+'" readonly></td>';
				h += '<td class="n" >'+o.outpoint.index+'</td>';
				h += '<td class="ammount" data-inputid="'+(i)+'"><span class="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span></td>';
				//h += '<td class="script"><input class="form-control" type="text" value="'+Crypto.util.bytesToHex(o.script.buffer)+'" readonly></td>';
				h += '<td class="script"><a href="#" data-index-inputscript="'+i+'">Advanced</a>';
				h += '<td class="signed">';
					h += '<span class="glyphicon glyphicon-'+((s.signed=='true')?'ok':'remove')+'-circle"></span>';
					if(s['type']=='multisig' && s['signatures']>=1){
						h += '<a href="#" data-index-multisig="'+i+'">';
						h += ' '+s['signatures'];
						h += '</a>';
					}
				h += '</td>';
				h += '<td class="multisig">';
				if(s['type']=='multisig'){
					h += '<a href="#" data-index-multisig="'+i+'">';
					var script = coinjs.script();
					var rs = script.decodeRedeemScript(s.script);
					h += rs['signaturesRequired']+' of '+rs['pubkeys'].length;
					h += '</a>';
				} else {
					h += '<span class="glyphicon glyphicon-remove-circle"></span>';
				}
				h += '</td>';
				h += '</tr>';
				
				$(h).appendTo("#verifyTransactionData .ins tbody");

				$("#verifyTransactionData .ins tbody").data("tx", decode);
				
				if (toolkit.getInputAmount != "disabled") {
					(function (inputid, total) {
						providers[$("#coinSelector").val()].getInputAmount[toolkit.getInputAmount](o.outpoint.hash, o.outpoint.index, function(result) {
							$("#verifyTransactionData .ins tbody td[data-inputid="+inputid+"]").html((result)?coinjs.formatAmount(result):'Not found');
							if (result) {
								amountTotal += result;
								if (++inAmountAvailable == total) {
									$.each(decode.outs, function(i,o){
										amountTotal -= o.value;
									});
									
									if ((amountTotal/("1e"+coinjs.decimalPlaces)).toFixed(coinjs.decimalPlaces) > 0.011) {
										$("#verifyTransactionData .fee").attr("style", "color: red;")
									}
									$("#verifyTransactionData .fee").removeClass("hidden");
									$("#verifyTransactionData .fee .amount").html(coinjs.formatAmount(amountTotal));
								}
							}
						});
					})(i, decode.ins.length);
				} else {
					$("#verifyTransactionData .ins tbody td[data-inputid="+i+"]").html("Not available");
				}
			});

			h = '';
			$.each(decode.outs, function(i,o){

				if(o.script.chunks.length==2 && o.script.chunks[0]==106){ // OP_RETURN

					var data = Crypto.util.bytesToHex(o.script.chunks[1]);
					var dataascii = hex2ascii(data);

					if(dataascii.match(/^[\s\d\w]+$/ig)){
						data = dataascii;
					}

					h += '<tr>';
					h += '<td><input type="text" class="form-control" value="(OP_RETURN) '+data+'" readonly></td>';
					h += '<td></td>'; // to account for known address value
					h += '<td class="col-xs-1">'+(o.value/("1e"+coinjs.decimalPlaces)).toFixed(coinjs.decimalPlaces)+'</td>';
					h += '<td class="col-xs-2"><input class="form-control" type="text" value="'+Crypto.util.bytesToHex(o.script.buffer)+'" readonly></td>';
					h += '</tr>';
				} else {

					var addr = '';
					var identity = '';
					if(o.script.chunks.length==5){
						var pubKeyHash = Crypto.util.bytesToHex(o.script.chunks[2])
						addr = coinjs.scripthash2address(pubKeyHash, coinjs.pub);
						$.each(known.pubKey, function(pubkey, id) {
							if (coinjs.pubkey2address(pubkey, coinjs.pub) == addr) {
								identity = known.pubKey[pubkey].name;
								return false;
							}
						});
					} else if((o.script.chunks.length==2) && o.script.chunks[0]==0){
						addr = coinjs.bech32_encode(coinjs.bech32.hrp, [coinjs.bech32.version].concat(coinjs.bech32_convert(o.script.chunks[1], 8, 5, true)));
					} else {
						var scriptHash = Crypto.util.bytesToHex(o.script.chunks[1]);
						addr = coinjs.scripthash2address(scriptHash, coinjs.multisig);
						if (known.scriptHash[scriptHash]) {
							identity = known.scriptHash[scriptHash].name;
						}
					}

					h += '<tr>';
					h += '<td class="col-xs-5"><input class="form-control" type="text" value="'+addr+'" readonly></td>';
					h += '<td class="col-xs-5"><input class="form-control" type="text" value="'+identity+'" readonly></td>';
					h += '<td class="">'+coinjs.formatAmount(o.value)+'</td>';
					h += '<td class=""><a href="#" data-index-outputscript="'+i+'">Advanced</a></td>';
					h += '</tr>';
				}
			});
			$(h).appendTo("#verifyTransactionData .outs tbody");

			$("#verify .verifyLink").val(document.location.origin+''+document.location.pathname+'?mode='+$("#coinSelector").val()+'&verify='+$("#verifyScript").val());
			history.pushState({}, null, $("#verify .verifyLink").val());
			return true;
		} catch(e) {
			return false;
		}
	}

	function decodeMultiSig(tx, i) {
		var html = '';
		var list = tx.listMultiSignature(i);
		
		for (var pubkey in list) {
			identity = "";
			if (known.pubKey[pubkey]) {
				identity = known.pubKey[pubkey].name;
			}
			
			var address = coinjs.pubkey2address(pubkey);
			var signature_position = '';
			if (list[pubkey]) {
				for (var x = 0; x < list[pubkey].length; x++) {
					if (x > 0) {signature_position += ", "}
					signature_position += '<abbr title="'+list[pubkey][x].sig+'">'+(list[pubkey][x].pos+1)+'</abbr>'
				}
			}
			html += '<tr style="'+ ((list[pubkey]) ? 'background-color: rgb(223, 240, 216);':'') +'">\
				<td class="sig_position">\
					'+signature_position+'\
				</td>\
				<td>\
					<input type="text" class="form-control" value="'+address+'" readonly>\
				</td>\
				<td>\
					<input type="text" class="form-control" value="'+pubkey+'" readonly>\
				</td>\
				<td>\
					<input type="text" class="form-control" value="'+identity+'" readonly>\
				</td>\
			</tr>';
		}
		
		$("#modalMultisig table tbody").html(html);
		$("#modalMultisig .combine .alert").addClass("hidden");
		
		$("#modalMultisig .combineTx").click(function() {
			var newTx = tx.combineMultiSignature($("#modalMultisig .combine textarea").val());
			if (newTx) {
				if (coinjs.debug) {console.log(newTx, newTx.serialize())};
				$("#verifyScript").val(newTx.serialize()).fadeOut().fadeIn();
				$("#verifyBtn").click();
				
				$("#modalMultisig .combine .alert").addClass("hidden");
				$("#modalMultisig").modal("hide");
				
				window.location.hash = "#verify";
			} else {
				$("#modalMultisig .combine .alert").removeClass("hidden");
			}
		});
		$("#modalMultisig").modal("show");
	}

	function decodeScript(script) {
		var asm = '';
		var multisig = false;

		var pieces = script.toASM().split(" ");
		for (i = 0; i < pieces.length; i++) {
			if (i == pieces.length-1) {
				var maybemultisig = coinjs.script(pieces[i]);
				if (maybemultisig.chunks[maybemultisig.chunks.length - 1] == coinjs.opcode.OP_CHECKMULTISIG) {
					multisig = true;
				}
			}

			asm += '<span style="display: inline-block;width: 100%;">';
			

			if (multisig) {
				asm += '<span style="color: rgb(197, 197, 197);">'+pieces[i]+'</span>'

				var inner_pieces = maybemultisig.toASM().split(" ");
				for (x = 0; x < inner_pieces.length; x++) {
					asm += '<span style="display: inline-block;width: 100%;margin-left: 20px;">'+inner_pieces[x];
					console.log(known.scriptHash[inner_pieces[x]]);
					if (known.pubKey[inner_pieces[x]]) {
						asm += '<span style="color: #17AD0E;"> (Match with '+known.pubKey[inner_pieces[x]].name+')</span>';
					} else if (known.scriptHash[inner_pieces[x]]) {
						asm += '<span style="color: #17AD0E;"> (Match with '+known.scriptHash[inner_pieces[x]].name+')</span>';
					}
					asm += '</span></br>';
				}
			} else {
				asm += pieces[i];
				if (known.pubKey[pieces[i]]) {
					asm += '<span style="color: #17AD0E;"> (Match with '+known.pubKey[pieces[i]].name+')</span>';
				} else if (known.scriptHash[pieces[i]]) {
					asm += '<span style="color: #17AD0E;"> (Match with '+known.scriptHash[pieces[i]].name+')</span>';
				}
			}

			asm += '</span></br>';
		}

		$("#modalScript .asm").html(asm);

		$("#modalScript").modal("show");
	}

	function hex2ascii(hex) {
		var str = '';
		for (var i = 0; i < hex.length; i += 2)
			str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
		return str;
	}

	function decodePrivKey(){
		var wif = $("#verifyScript").val();
		if(wif.length==51 || wif.length==52){
			try {
				var w2address = coinjs.wif2address(wif);
				var w2pubkey = coinjs.wif2pubkey(wif);
				var w2privkey = coinjs.wif2privkey(wif);

				$("#verifyPrivKey .address").val(w2address['address']);
				$("#verifyPrivKey .pubkey").val(w2pubkey['pubkey']);
				$("#verifyPrivKey .privkey").val(w2privkey['privkey']);
				$("#verifyPrivKey .iscompressed").html(w2address['compressed']?'true':'false');

				$("#verifyPrivKey").removeClass("hidden");
				return true;
			} catch (e) {
				return false;
			}
		} else {
			return false;
		}
	}

	function decodePubKey(){
		var pubkey = $("#verifyScript").val();
		if(pubkey.length==66 || pubkey.length==130){
			try {
				$("#verifyPubKey .verifyDataSw").addClass('hidden');
				$("#verifyPubKey .address").val(coinjs.pubkey2address(pubkey));
				if(pubkey.length == 66){
					var sw = coinjs.segwitAddress(pubkey);
					$("#verifyPubKey .addressSegWit").val(sw.address);
					$("#verifyPubKey .addressSegWitRedeemScript").val(sw.redeemscript);

					var b32 = coinjs.bech32Address(pubkey);
					$("#verifyPubKey .addressBech32").val(b32.address);
					$("#verifyPubKey .addressBech32RedeemScript").val(b32.redeemscript);

					$("#verifyPubKey .verifyDataSw").removeClass('hidden');
				}
				$("#verifyPubKey").removeClass("hidden");
				$("#verify .verifyLink").val(document.location.origin+''+document.location.pathname+'?mode='+$("#coinSelector").val()+'&verify='+$("#verifyScript").val());
				history.pushState({}, null, $("#verify .verifyLink").val());
				return true;
			} catch (e) {
				return false;
			}
		} else {
			return false;
		}
	}

	function decodeHDaddress(){
		coinjs.compressed = true;
		var s = $("#verifyScript").val();
		try {
			var hex = Crypto.util.bytesToHex((coinjs.base58decode(s)).slice(0,4));
			var hex_cmp_prv = Crypto.util.bytesToHex((coinjs.numToBytes(coinjs.hdkey.prv,4)).reverse());
			var hex_cmp_pub = Crypto.util.bytesToHex((coinjs.numToBytes(coinjs.hdkey.pub,4)).reverse());
			if(hex == hex_cmp_prv || hex == hex_cmp_pub){
				var hd = coinjs.hd(s);
				$("#verifyHDaddress .hdKey").html(s);
				$("#verifyHDaddress .chain_code").val(Crypto.util.bytesToHex(hd.chain_code));
				$("#verifyHDaddress .depth").val(hd.depth);
				$("#verifyHDaddress .version").val('0x'+(hd.version).toString(16));
				$("#verifyHDaddress .child_index").val(hd.child_index);
				$("#verifyHDaddress .hdwifkey").val((hd.keys.wif)?hd.keys.wif:'');
				$("#verifyHDaddress .key_type").html((((hd.depth==0 && hd.child_index==0)?'Master':'Derived')+' '+hd.type).toLowerCase());
				$("#verifyHDaddress .parent_fingerprint").val(Crypto.util.bytesToHex(hd.parent_fingerprint));
				$("#verifyHDaddress .derived_data table tbody").html("");
				deriveHDaddress();
				// Not sharing private keys! $("#verify .verifyLink").val(document.location.origin+''+document.location.pathname+'?mode='+$("#coinSelector").val()+'&verify='+$("#verifyScript").val());
				$("#verifyHDaddress").removeClass("hidden");
				return true;
			}
		} catch (e) {
			return false;
		}
	}

	function deriveHDaddress() {
		var hd = coinjs.hd($("#verifyHDaddress .hdKey").html());
		var index_start = $("#verifyHDaddress .derivation_index_start").val()*1;
		var index_end = $("#verifyHDaddress .derivation_index_end").val()*1;
		var html = '';
		$("#verifyHDaddress .derived_data table tbody").html("");
		for(var i=index_start;i<=index_end;i++){
			var derived = hd.derive(i);
			html += '<tr>';
			html += '<td>'+i+'</td>';
			html += '<td><input type="text" class="form-control" value="'+derived.keys.address+'" readonly></td>';
			html += '<td><input type="text" class="form-control" value="'+((derived.keys.wif)?derived.keys.wif:'')+'" readonly></td>';
			html += '<td><input type="text" class="form-control" value="'+derived.keys_extended.pubkey+'" readonly></td>';
			html += '<td><input type="text" class="form-control" value="'+((derived.keys_extended.privkey)?derived.keys_extended.privkey:'')+'" readonly></td>';
			html += '</tr>';
		}
		$(html).appendTo("#verifyHDaddress .derived_data table tbody");
	}

	function getMouseXY(e) {
		var tempX = 0;
		var tempY = 0;
		if (IE) { // If browser is IE
			tempX = event.clientX + document.body.scrollLeft;
			tempY = event.clientY + document.body.scrollTop;
		} else {
			tempX = e.pageX;
			tempY = e.pageY;
		};

		if (tempX < 0){tempX = 0};
		if (tempY < 0){tempY = 0};
		var xEnt = Crypto.util.bytesToHex([tempX]).slice(-2);
		var yEnt = Crypto.util.bytesToHex([tempY]).slice(-2);
		var addEnt = xEnt.concat(yEnt);

		if ($("#entropybucket").html().indexOf(xEnt) == -1 && $("#entropybucket").html().indexOf(yEnt) == -1) {
			$("#entropybucket").html(addEnt + $("#entropybucket").html());
		};

		if ($("#entropybucket").html().length > 128) {
			$("#entropybucket").html($("#entropybucket").html().slice(0, 128))
		};

		return true;
	};

	/* page load code */

	function _get(value) {
		var dataArray = (document.location.search).match(/(([a-z0-9\_\[\]]+\=[a-z0-9\_\.\%\@]+))/gi);
		var r = [];
		if(dataArray) {
			for(var x in dataArray) {
				if((dataArray[x]) && typeof(dataArray[x])=='string') {
					if((dataArray[x].split('=')[0].toLowerCase()).replace(/\[\]$/ig,'') == value.toLowerCase()) {
						r.push(unescape(dataArray[x].split('=')[1]));
					}
				}
			}
		}
		return r;
	}


	/* ledger */

	async function getLedgerAddress(format, callback) {
		try {
			const transport = await window.TransportWebUSB.create();
			const appBtc = new window.Btc(transport);
			result = await appBtc.getWalletPublicKey(
				coinjs.ledgerPath,
				{verify: false, format: format}
				);
			callback(result);
		} catch (e) {
			console.log(e);
		}
	}

	async function signWithLedgerAddress(messageText, callback) {
		try {
			const transport = await window.TransportWebUSB.create();
			const appBtc = new window.Btc(transport);
			result = await appBtc.signMessageNew(
				coinjs.ledgerPath,
				messageText
				);
			callback(result);
		} catch (e) {
			console.log(e);
		}
	}

	async function getLedgerSignatures(currenttransaction, hashType, callback) {
		try {
			const transport = await window.TransportWebUSB.create();
			const appBtc = new window.Btc(transport);

			var isPeercoin = true;
			if ($("#coinSelector").val() == "bitcoin") {
				isPeercoin = false;
				}

			result = await appBtc.getWalletPublicKey(
				coinjs.ledgerPath,
				{verify: false, format: "legacy"}
				);

			var publicKey = result.publicKey;
			var path = coinjs.ledgerPath;

			console.log("path",path,"address",result.bitcoinAddress,"pubkey",result.publicKey);
			var txn = appBtc.splitTransaction(currenttransaction.serialize(),false,isPeercoin);
			var outputsBuffer = Crypto.util.bytesToHex(appBtc.serializeTransactionOutputs(txn));

			var inputs = [];
			var paths = [];

			// TODO: check if gettransaction is available

			// extract script part
			var script = Crypto.util.bytesToHex(currenttransaction.ins[0].script.buffer);

			if (currenttransaction.ins[0].script.buffer.slice(-1) == coinjs.opcode.OP_CHECKMULTISIG && currenttransaction.ins[0].script.chunks.slice(-1)[0] != coinjs.opcode.OP_CHECKMULTISIG) {
				script = Crypto.util.bytesToHex(currenttransaction.ins[0].script.chunks.slice(-1)[0]);
				}

			for (var i = 0; i < currenttransaction.ins.length; i++) {
				var result = providers[$("#coinSelector").val()].getTransaction[toolkit.getTransaction](currenttransaction.ins[i].outpoint.hash,i,async function(result) {
				// todo replace !isPeercoin with proper segwit support flag from coinjs params
					inputs.push([result[1],appBtc.splitTransaction(result[0],!isPeercoin,isPeercoin),currenttransaction.ins[result[1]].outpoint.index,script]);
					paths.push(path);
					if (inputs.length == currenttransaction.ins.length) {
						// we are ready

						console.log("raw inputs",inputs,"paths",paths,"outputs",outputsBuffer,"time",currenttransaction.nTime);

						var timeStamp = undefined;
						if (isPeercoin) {
							timeStamp = currenttransaction.nTime;
							}

						// sort array

						inputs.sort((a, b) => (a[0] > b[0]) ? 1 : -1);
						inputs.map(item=> {item.splice(0,1)});
						var result=false;
						if (currenttransaction.ins[0].script.buffer.slice(-1) == coinjs.opcode.OP_CHECKMULTISIG) {
							// check if public key is part of multisig
							result = await appBtc.signP2SHTransaction(inputs, paths, outputsBuffer, undefined, hashType, false, undefined, timeStamp);

							var success=false;

							console.log("signature result",result);
							$.each(result, function(idx,itm) {
								var signature = Crypto.util.hexToBytes(itm);
								if (currenttransaction.signmultisig(idx,undefined,signature.slice(-1)[0]*1,signature)) {
									success=true;
									}
								});
								if (success) {
									callback(currenttransaction.serialize());
									}
								else {
									callback(false);
									}
								}
						else {
							result = await appBtc.createPaymentTransactionNew(inputs, paths, undefined, outputsBuffer, undefined, undefined, undefined, timeStamp);
							callback(result);
							}
						}
					});
				}
		} catch (e) {
			console.log(e);
		}
	}


	/* external providers */

	var iquidusBasedExplorer = {
		listUnspent: function(endpoint) {
			return function(redeem){
				var msgSucess = '<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="' + endpoint + '/ext/listunspent/'+redeem.addr+'" target="_blank">'+redeem.addr+'</a>'
				var msgError = '<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs! Is <a href="' + endpoint + '/">' + endpoint + '/</a> down?';
				$.ajax ({
					type: "GET",
					url: "" + endpoint + "/ext/listunspent/"+redeem.addr,
					dataType: "json",
					error: function(data) {
						$("#redeemFromStatus").removeClass('hidden').html(msgError);
						$("#redeemFromBtn").html("Load").attr('disabled',false);
					},
					success: function(data) {
						if (coinjs.debug) {console.log(data)};
						if ((data.unspent_outputs)){
							$("#redeemFromAddress").removeClass('hidden').html(
								'<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="'+endpoint+'/ext/listunspent/'+
								redeem.addr+'" target="_blank">'+redeem.addr+'</a>');
							for(i = 0; i < data.unspent_outputs.length; ++i){
								var o = data.unspent_outputs[i];
								var tx = ""+o.tx_hash;
								if(tx.match(/^[a-f0-9]+$/)){
									var n = o.tx_ouput_n;
									var script = (redeem.type=="multisig__") ? $("#redeemFrom").val() : o.script;
									var amount = (o.value /100000000).toFixed(8);;
									addOutput(tx, n, script, amount);
								}
							}
						} else {
							$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs.');
						}
					},
					complete: function(data, status) {
						$("#redeemFromBtn").html("Load").attr('disabled',false);
						totalInputAmount();
					}
				});
			}
		},
		getTransaction: function(endpoint) {
			return function(txid, index, callback){
								   var msgSucess = '<span class="glyphicon glyphicon-info-sign"></span> Retrieved transaction info from txid <a href="' + endpoint + '/ext/txinfo/'+txid+'" target="_blank">'+txid+'</a>'
								   var msgError = '<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs! Is <a href="' + endpoint + '/">' + endpoint + '/</a> down?';
					$.ajax ({
						type: "GET",
						url: "" + endpoint + "/api/getrawtransaction?txid="+txid,
						dataType: "text",
						error: function(data) {
							$("#redeemFromStatus").removeClass('hidden').html(msgError);
							$("#redeemFromBtn").html("Load").attr('disabled',false);
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if (data){
								callback([data,index]);
							} else {
								$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve transation info');
								callback(false);
							}
						}
//,
//						  complete: function(data, status) {
//							  $("#redeemFromBtn").html("Load").attr('disabled',false);
//							  totalInputAmount();
//						  }
					});
				}
			},
		getInputAmount: function(endpoint) {
			return function(txid, index, callback) {
				$.ajax ({
					type: "GET",
					url: "" + endpoint + "/ext/txinfo/"+txid,
					dataType: "json",
					error: function(data) {
						callback(false);
					},
					success: function(data) {
						if (coinjs.debug) {console.log(data)};
						var result = false;
						for(var i=0;i<data.outputs.length;i++){
							if (data.outputs[i].n == index) {result=data.outputs[i].amount/100};
						}
						callback(result);
					},
				});
			}
		},
		broadcast: function(endpoint) {
			return function(thisbtn){
				var orig_html = $(thisbtn).html();
				$(thisbtn).html('Please wait, loading... <span class="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span>').attr('disabled',true);
				$.ajax ({
					type: "GET",
					url: "" + endpoint + "/api/sendrawtransaction?hex="+$("#rawTransaction").val(),
					dataType: "text", //"json",
					error: function(data, status, error) {
						var obj = data.responseText; //$.parseJSON(data.responseText);
						var r = '';
						r += obj.length ? obj : '';//(obj.data.tx_hex) ? obj.data.tx_hex : '';
						r = (r!='') ? r : ' Failed to broadcast'; // build response 
						$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(r).prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
					},
						success: function(data) {
						//var obj = data.responseText; //$.parseJSON(data.responseText);
						if(data.length){
							$("#rawTransactionStatus").addClass('alert-success').removeClass('alert-danger').removeClass("hidden").html(' Txid: '+data);
						} else {
							$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(' Unexpected error, please try again').prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
						}
					},
					complete: function(data, status) {
						$("#rawTransactionStatus").fadeOut().fadeIn();
						$(thisbtn).html(orig_html).attr('disabled',false);				
					}
				});
			}
		}
	};

	var peerBlockbookBasedExplorer = {
		listUnspent: function(endpoint) {
			return function(redeem){
				var msgSucess = '<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="' + endpoint + '/ext/listunspent/'+redeem.addr+'" target="_blank">'+redeem.addr+'</a>'
				var msgError = '<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs! Is <a href="' + endpoint + '/">' + endpoint + '/</a> down?';
				$.ajax ({
					type: "GET",
					url: "" + endpoint + "/api/utxo/"+redeem.addr,
					dataType: "json",
					error: function(data) {
						$("#redeemFromStatus").removeClass('hidden').html(msgError);
						$("#redeemFromBtn").html("Load").attr('disabled',false);
					},
					success: function(data) {
						if (coinjs.debug) {console.log(data)};
						if ((data)){
							$("#redeemFromAddress").removeClass('hidden').html(
								'<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="'+endpoint+'/ext/listunspent/'+
								redeem.addr+'" target="_blank">'+redeem.addr+'</a>');
							var utxos = data;
							var calcCount = 0;
							for(k = utxos.length - 1; k >= 0; --k){
								$.ajax ({
									type: "GET",
									url: "" + endpoint + "/api/tx/"+utxos[k].txid,
									dataType: "json",
									error: function(data) {
									},
									success: function(data) {
										for (i = 0 ; i < utxos.length ; i ++){
											if (utxos[i].txid == data.txid){
												break;
											}
										}
										var utxo = utxos[i];
										var tx = ""+utxo.txid;
										if(tx.match(/^[a-f0-9]+$/)){
											var n = utxo.vout;
											var script = (redeem.redeemscript==true) ? redeem.decodedRs : data.vout[utxo.vout].scriptPubKey.hex;
											var amount = (utxo.satoshis /100000000).toFixed(8);
											addOutput(tx, n, script, amount);
										}

										calcCount ++;
									},
									complete: function(data, status) {
										if (calcCount == utxos.length) {
											$("#redeemFromBtn").html("Load").attr('disabled',false);
											totalInputAmount();
										}
									}
								});
							}
						} else {
							$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs.');
						}
					},
					complete: function(data, status) {
						$("#redeemFromBtn").html("Load").attr('disabled',false);
						totalInputAmount();
					}
				});
			}
		},
		getTransaction: function(endpoint) {
			return function(txid, index, callback){
								   var msgSucess = '<span class="glyphicon glyphicon-info-sign"></span> Retrieved transaction info from txid <a href="' + endpoint + '/ext/txinfo/'+txid+'" target="_blank">'+txid+'</a>'
								   var msgError = '<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs! Is <a href="' + endpoint + '/">' + endpoint + '/</a> down?';
					$.ajax ({
						type: "GET",
						url: "" + endpoint + "/api/tx/"+txid,
						dataType: "json",
						error: function(data) {
							$("#redeemFromStatus").removeClass('hidden').html(msgError);
							$("#redeemFromBtn").html("Load").attr('disabled',false);
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if (data.hex){
								callback([data.hex,index]);
							} else {
								$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve transation info');
								callback(false);
							}
						}
						,
						  complete: function(data, status) {
							  $("#redeemFromBtn").html("Load").attr('disabled',false);
							  totalInputAmount();
						  }
					});
				}
			},
		getInputAmount: function(endpoint) {
			return function(txid, index, callback) {
				$.ajax ({
					type: "GET",
					url: "" + endpoint + "/api/tx/"+txid,
					dataType: "json",
					error: function(data) {
						callback(false);
					},
					success: function(data) {
						if (coinjs.debug) {console.log(data)};
						var result = false;
						for(var i=0;i<data.vout.length;i++){
							if (data.vout[i].n == index) {result=data.vout[i].value*1000000};
						}
						callback(result);
					},
				});
			}
		},
		broadcast: function(endpoint) {
			return function(thisbtn){
				var orig_html = $(thisbtn).html();
				$(thisbtn).html('Please wait, loading... <span class="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span>').attr('disabled',true);
				$.ajax ({
					type: "POST",
					url: "" + endpoint + "/api/sendtx/",
					data: $("#rawTransaction").val(),
					dataType: "text", //"json",
					error: function(data, status, error) {
						var obj = data.responseText; //$.parseJSON(data.responseText);
						var r = '';
						r += obj.length ? obj : '';//(obj.data.tx_hex) ? obj.data.tx_hex : '';
						r = (r!='') ? r : ' Failed to broadcast'; // build response 
						$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(r).prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
					},
					success: function(data) {
						var obj = $.parseJSON(data);
						if(obj.result){
							$("#rawTransactionStatus").addClass('alert-success').removeClass('alert-danger').removeClass("hidden").html(' Txid: '+obj.result);
						} else {
							$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(' Unexpected error, please try again').prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
						}
					},
					complete: function(data, status) {
						$("#rawTransactionStatus").fadeOut().fadeIn();
						$(thisbtn).html(orig_html).attr('disabled',false);				
					}
				});
			}
		}
	};

	var gitmultisig_listunspent = function(redeem, github_repository) {
		if (!redeem.isMultisig) {
			$("#redeemFromStatus").removeClass('hidden').html('This provider does not store scripts of unspent transactions, so transactions from single-signature addresses are impossible to create. Please <a href="#settings">select another provider</a>');
			$("#redeemFromBtn").html("Load").attr('disabled',false);
			return;
		}

		var msgSucess = '<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="https://raw.githubusercontent.com/'+github_repository+'/master/'+redeem.addr+'/unspent" target="_blank">'+redeem.addr+'</a>'		
		var msgError = '<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs! This provider only store unspent outputs for FLOT addresses <a href="https://github.com/'+github_repository+'">https://github.com/'+github_repository+'</a>. Please <a href="#settings">select another provider</a>';
		$.ajax ({
			type: "GET",
			url: "https://raw.githubusercontent.com/"+github_repository+"/master/"+redeem.addr+"/unspent",
			dataType: "json",
			error: function(data) {
				$("#redeemFromStatus").removeClass('hidden').html(msgError);
				$("#redeemFromBtn").html("Load").attr('disabled',false);
			},
			success: function(data) {
				if (coinjs.debug) {console.log(data)};
				if (typeof(data.unspent) != "object") {
					$("#redeemFromStatus").removeClass('hidden').html(msgError);
					$("#redeemFromBtn").html("Load").attr('disabled',false);
				} else {
					console.log(1);
					for(var i=0;i<data.unspent.length;i++){						
						var script = $("#redeemFrom").val();
						addOutput(data.unspent[i].txid, data.unspent[i].vout, script, data.unspent[i].value);
					}
					$("#redeemFromAddress").removeClass('hidden').html(msgSucess);
				}
			},
			complete: function(data, status) {
				$("#redeemFromBtn").html("Load").attr('disabled',false);
				totalInputAmount();
			}
		});
	};

	/* bit(coinb.in) api vars */
	coinjs.host = '//coinb.in/api/';
	coinjs.uid = '1';
	coinjs.key = '12345678901234567890123456789012';
	
	var providers = {
		bitcoin: {
			listUnspent: {
				"blockcypher": function(redeem){
					$.ajax ({
						type: "GET",
						url: "https://api.blockcypher.com/v1/btc/main/addrs/"+redeem.addr+"?unspentOnly=true&includeScript=true",
						dataType: "json",
						error: function(data) {
							$("#redeemFromStatus").removeClass('hidden').html(msgError);
							$("#redeemFromBtn").html("Load").attr('disabled',false);
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if ((data.txrefs)){
								$("#redeemFromAddress").removeClass('hidden').html(
									'<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="https://api.blockcypher.com/v1/btc/main/addrs/"'+
									redeem.addr+'" target="_blank">'+redeem.addr+'</a>');
								for(i = 0; i < data.txrefs.length; ++i){
									var o = data.txrefs[i];
									var tx = ""+o.tx_hash;
									if(tx.match(/^[a-f0-9]+$/)){
										var n = o.tx_output_n;
										var script = (redeem.type == "multisig__") ? $("#redeemFrom").val() : o.script;
										var amount = (o.value /100000000).toFixed(8);;
										addOutput(tx, n, script, amount);
									}
								}
							} else {
								$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs.');
							}
						},
						complete: function(data, status) {
							$("#redeemFromBtn").html("Load").attr('disabled',false);
							totalInputAmount();
						}
					});
				},
				"cryptoid": function(redeem){
					$.ajax ({
						type: "GET",
						url: "https://chainz.cryptoid.info/btc/api.dws?q=unspent&key="+coinjs.apikey+"&active="+redeem.addr,
						dataType: "json",
						error: function(data) {
							$("#redeemFromStatus").removeClass('hidden').html(msgError);
							$("#redeemFromBtn").html("Load").attr('disabled',false);
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if ((data.unspent_outputs)){
								$("#redeemFromAddress").removeClass('hidden').html(
									'<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="https://chainz.cryptoid.info/ppc/address.dws?'+
									redeem.addr+'" target="_blank">'+redeem.addr+'</a>');
								for(i = 0; i < data.unspent_outputs.length; ++i){
									var o = data.unspent_outputs[i];
									var tx = ""+o.tx_hash;
									if(tx.match(/^[a-f0-9]+$/)){
										var n = o.tx_ouput_n;
										var script = (redeem.isMultisig==true) ? $("#redeemFrom").val() : o.script;
										var amount = (o.value /100000000).toFixed(8);;
										addOutput(tx, n, script, amount);
									}
								}
							} else {
								$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs.');
							}
						},
						complete: function(data, status) {
							$("#redeemFromBtn").html("Load").attr('disabled',false);
							totalInputAmount();
						}
					});
				},
				"blockr.io": function(redeem){
					$.ajax ({
						type: "GET",
						url: "//btc.blockr.io/api/v1/address/unspent/"+redeem.addr+"?unconfirmed=1",
						dataType: "json",
						error: function(data) {
							$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs!');
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if (data.status && data.data && data.status=='success'){
								$("#redeemFromAddress").removeClass('hidden').html('<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="//btc.blockr.io/address/info/'+redeem.addr+'" target="_blank">'+redeem.addr+'</a>');
								for(var i in data.data.unspent){
									var o = data.data.unspent[i];
									var script = (redeem.isMultisig==true) ? $("#redeemFrom").val() : o.script;
									
									addOutput(o.tx, o.n, script, o.amount);
								}
							} else {
								$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs.');
							}
						},
						complete: function(data, status) {
							$("#redeemFromBtn").html("Load").attr('disabled',false);
							totalInputAmount();
						}
					});
				},
				"coinb.in": function(redeem){
					$.ajax ({
						type: "GET",
						url: coinjs.host+'?uid='+coinjs.uid+'&key='+coinjs.key+'&setmodule=addresses&request=unspent&address='+redeem.addr+'&r='+Math.random(),
						dataType: "xml",
						error: function(data) {
							if (coinjs.debug) {console.log(data)};
							$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs!');
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if ($(data).children("request").children("result").text()){
								$("#redeemFromAddress").removeClass('hidden').html('<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address '+redeem.addr+'');
								$.each($(data).children("request").children("unspent").children(), function(i,o){
									var tx = (($(o).find("tx_hash").text()).match(/.{1,2}/g).reverse()).join("")+'';
									var n = $(o).find("tx_output_n").text();
									var script = (redeem.isMultisig==true) ? $("#redeemFrom").val() : $(o).find("script").text();
									var amount = (($(o).find("value").text()*1)/("1e"+coinjs.decimalPlaces)).toFixed(coinjs.decimalPlaces);

									addOutput(tx, n, script, amount);
								});
							} else {
								$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs.');
							}
						},
						complete: function(data, status) {
							$("#redeemFromBtn").html("Load").attr('disabled',false);
							totalInputAmount();
						}
					});
				},
			},
			broadcast: {
				"blockcypher": function(thisbtn){
					var orig_html = $(thisbtn).html();
					$(thisbtn).html('Please wait, loading... <span class="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span>').attr('disabled',true);
					$.ajax ({
						type: "POST",
						url: "https://api.blockcypher.com/v1/btc/main/txs/push?token=c351f5d9782543b8b0416b8dff76b8e2",
						data: {"tx":$("#rawTransaction").val()},
						dataType: "json",
						error: function(data) {
							var r = '';
							r += (data.data) ? data.data : '';
							r += (data.message) ? ' '+data.message : '';
							r = (r!='') ? r : ' Failed to broadcast. Internal server error';
							$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(r).prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
						},
						success: function(data) {
							if(data.hash){
								$("#rawTransactionStatus").addClass('alert-success').removeClass('alert-danger').removeClass("hidden").html(' Txid: '+data.hash);
							} else {
								$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(' Unexpected error, please try again').prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
							}				
						},
						complete: function(data, status) {
							$("#rawTransactionStatus").fadeOut().fadeIn();
							$(thisbtn).html(orig_html).attr('disabled',false);				
						}
					});
				},
				"blockr.io": function(thisbtn){
					var orig_html = $(thisbtn).html();
					$(thisbtn).html('Please wait, loading... <span class="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span>').attr('disabled',true);
					$.ajax ({
						type: "POST",
						url: "//btc.blockr.io/api/v1/tx/push",
						data: {"hex":$("#rawTransaction").val()},
						dataType: "json",
						error: function(data) {
							var r = '';
							r += (data.data) ? data.data : '';
							r += (data.message) ? ' '+data.message : '';
							r = (r!='') ? r : ' Failed to broadcast. Internal server error';
							$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(r).prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
						},
						success: function(data) {
							if((data.status && data.data) && data.status=='success'){
								$("#rawTransactionStatus").addClass('alert-success').removeClass('alert-danger').removeClass("hidden").html(' Txid: '+data.data);
							} else {
								$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(' Unexpected error, please try again').prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
							}				
						},
						complete: function(data, status) {
							$("#rawTransactionStatus").fadeOut().fadeIn();
							$(thisbtn).html(orig_html).attr('disabled',false);				
						}
					});
				},
				"coinb.in": function(thisbtn){ 
					var orig_html = $(thisbtn).html();		
					$(thisbtn).html('Please wait, loading... <span class="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span>').attr('disabled',true);
					$.ajax ({
						type: "G",
						url: coinjs.host+'?uid='+coinjs.uid+'&key='+coinjs.key+'&setmodule=bitcoin&request=sendrawtransaction',
						data: {'rawtx':$("#rawTransaction").val()},
						dataType: "xml",
						error: function(data) {
							$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(" There was an error submitting your request, please try again").prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
						},
						success: function(data) {
							$("#rawTransactionStatus").html(unescape($(data).find("response").text()).replace(/\+/g,' ')).removeClass('hidden');
							if($(data).find("result").text()==1){
								$("#rawTransactionStatus").addClass('alert-success').removeClass('alert-danger');
								$("#rawTransactionStatus").html('txid: '+$(data).find("txid").text());
							} else {
								$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').prepend('<span class="glyphicon glyphicon-exclamation-sign"></span> ');
							}
						},
						complete: function(data, status) {
							$("#rawTransactionStatus").fadeOut().fadeIn();
							$(thisbtn).html(orig_html).attr('disabled',false);				
						}
					});
				}
			},
			getTransaction: {
				"blockcypher": function(txid, index, callback) {
					$.ajax ({
						type: "GET",
						url: "https://api.blockcypher.com/v1/btc/main/txs/"+txid+"?includeHex=true",
						dataType: "json",
						error: function(data) {
							callback(false);
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if (data.hex){
								callback([data.hex,index]);
							} else {
								callback(false);
							}
						}
					});
				}
			},
			getInputAmount: {
				"blockcypher": function(txid, index, callback) {
					$.ajax ({
						type: "GET",
						url: "https://api.blockcypher.com/v1/btc/main/txs/"+txid,
						dataType: "json",
						error: function(data) {
							callback(false);
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if (data.outputs && data.outputs[index]){
								callback(parseInt(data.outputs[index].value, 10));
							} else {
								callback(false);
							}
						}
					});
				},
				"blockr.io": function(txid, index, callback) {
					$.ajax ({
						type: "GET",
						url: "https://btc.blockr.io/api/v1/tx/info/"+txid,
						dataType: "json",
						error: function(data) {
							callback(false);
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if (data.status && data.data && data.status=='success' && data.data.vouts[index]){
								callback(parseInt(data.data.vouts[index].amount*("1e"+coinjs.decimalPlaces), 10));
							} else {
								callback(false);
							}
						}
					});
				}
			}
		},
		bitcoin_cash: {
			listUnspent: {
				"blockexplorer": function(redeem){
					$.ajax ({
						type: "GET",
						url: "https://bitcoincash.blockexplorer.com/api/addr/"+redeem.addr+"/utxo/",
						dataType: "json",
						error: function(data) {
							$("#redeemFromStatus").removeClass('hidden').html(msgError);
							$("#redeemFromBtn").html("Load").attr('disabled',false);
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if ((data && data.length)){
								$("#redeemFromAddress").removeClass('hidden').html(
									'<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="https://bitcoincash.blockexplorer.com/api/addr/"'+
									redeem.addr+'" target="_blank">'+redeem.addr+'/utxo/</a>');
								for(i = 0; i < data.length; ++i){
									var o = data[i];
									var tx = ""+o.txid;
									if(tx.match(/^[a-f0-9]+$/)){
										var n = o.vout;
										var script = (redeem.isMultisig==true) ? $("#redeemFrom").val() : o.scriptPubKey;
										var amount = (o.satoshis /100000000).toFixed(8);;
										addOutput(tx, n, script, amount);
									}
								}
							} else {
								$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs.');
							}
						},
						complete: function(data, status) {
							$("#redeemFromBtn").html("Load").attr('disabled',false);
							totalInputAmount();
						}
					});
				}
			},
			broadcast: {
				"blockexplorer": function(thisbtn){
					var orig_html = $(thisbtn).html();
					$(thisbtn).html('Please wait, loading... <span class="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span>').attr('disabled',true);
					$.ajax ({
						type: "POST",
						url: "https://bitcoincash.blockexplorer.com/api/tx/send",
						data: {"rawtx":$("#rawTransaction").val()},
						dataType: "json",
						error: function(data) {
							var r = '';
							r += (data.data) ? data.data : '';
							r += (data.message) ? ' '+data.message : '';
							r = (r!='') ? r : ' Failed to broadcast. Internal server error';
							$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(r).prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
						},
						success: function(data) {
							if(data.txid){
								$("#rawTransactionStatus").addClass('alert-success').removeClass('alert-danger').removeClass("hidden").html(' Txid: '+data.txid);
							} else {
								$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(' Unexpected error, please try again').prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
							}
						},
						complete: function(data, status) {
							$("#rawTransactionStatus").fadeOut().fadeIn();
							$(thisbtn).html(orig_html).attr('disabled',false);
						}
					});
				}
			},
			getTransaction: {
				"blockexplorer": function(txid, index, callback) {
					$.ajax ({
						type: "GET",
						url: "https://bitcoincash.blockexplorer.com/api/rawtx/"+txid,
						dataType: "json",
						error: function(data) {
							callback(false);
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if (data.rawtx){
								callback([data.rawtx,index]);
							} else {
								callback(false);
							}
						}
					});
				}
			},
			getInputAmount: {
				"blockexplorer": function(txid, index, callback) {
					$.ajax ({
						type: "GET",
						url: "https://bitcoincash.blockexplorer.com/api/tx/"+txid,
						dataType: "json",
						error: function(data) {
							callback(false);
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if (data.vout && data.vout[index]){
								callback(data.vout[index].value*100000000);
							} else {
								callback(false);
							}
						}
					});
				}
			}
		},
		litecoin: {
			listUnspent: {
				"chain.so": function(redeem){
					$.ajax ({
						type: "GET",
						url: "//chain.so/api/v2/get_tx_unspent/ltc/"+redeem.addr,
						dataType: "json",
						error: function(data) {
							$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs!');
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if((data.status && data.data) && data.status=='success'){
								$("#redeemFromAddress").removeClass('hidden').html('<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="//btc.blockr.io/address/info/'+redeem.addr+'" target="_blank">'+redeem.addr+'</a>');
								for(var i in data.data.txs){
									var o = data.data.txs[i];
									var script = (redeem.isMultisig==true) ? $("#redeemFrom").val() : o.script_hex;

									addOutput(o.txid, o.output_no, script, o.value);
								}
							} else {
								$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs.');
							}
						},
						complete: function(data, status) {
							$("#redeemFromBtn").html("Load").attr('disabled',false);
							totalInputAmount();
						}
					});
				}
			},
			broadcast: {
				"blockr.io": function(thisbtn){
					var orig_html = $(thisbtn).html();
					$(thisbtn).html('Please wait, loading... <span class="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span>').attr('disabled',true);
					$.ajax ({
						type: "POST",
						url: "//ltc.blockr.io/api/v1/tx/push",
						data: {"hex":$("#rawTransaction").val()},
						dataType: "json",
						error: function(data) {
							var r = '';
							r += (data.data) ? data.data : '';
							r += (data.message) ? ' '+data.message : '';
							r = (r!='') ? r : ' Failed to broadcast. Internal server error';
							$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(r).prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
						},
						success: function(data) {
							if (coinjs.debug) {console.log(data)};
							if((data.status && data.data) && data.status=='success'){
								$("#rawTransactionStatus").addClass('alert-success').removeClass('alert-danger').removeClass("hidden").html(' Txid: '+data.data);
							} else {
								$("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(' Unexpected error, please try again').prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
							}
						},
						complete: function(data, status) {
							$("#rawTransactionStatus").fadeOut().fadeIn();
							$(thisbtn).hmtl(orig_html).attr('disabled',false);				
						}
					});
				}
			}
		},
		sparklecoin: {
			listUnspent: {
				"iquidus": iquidusBasedExplorer.listUnspent('https://explorer.sparklecoin.com')
			},
			broadcast: {
				"iquidus": iquidusBasedExplorer.broadcast('https://explorer.sparklecoin.com')
			},
			getTransaction: {
				"iquidus": iquidusBasedExplorer.getTransaction('https://explorer.sparklecoin.com')
			},
			getInputAmount: {
				"iquidus": iquidusBasedExplorer.getInputAmount('https://explorer.sparklecoin.com')
			}
		},
		sparklecoin_testnet: {
			listUnspent: {
				"iquidus": iquidusBasedExplorer.listUnspent('https://tseed.sparklecoin.com')
			},
			broadcast: {
				"iquidus": iquidusBasedExplorer.broadcast('https://tseed.sparklecoin.com')
			},
			getTransaction: {
				"iquidus": iquidusBasedExplorer.getInputAmount('https://tseed.sparklecoin.com')
			},
			getInputAmount: {
				"iquidus": iquidusBasedExplorer.getInputAmount('https://tseed.sparklecoin.com')
			}
		},
		peercoin: {
			listUnspent: {
				"blockbook": peerBlockbookBasedExplorer.listUnspent('https://blockbook.peercoin.net')
			},
			broadcast: {
				"blockbook": peerBlockbookBasedExplorer.broadcast('https://blockbook.peercoin.net')
			},
			getTransaction: {
				"blockbook": peerBlockbookBasedExplorer.getTransaction('https://blockbook.peercoin.net')
			},
			getInputAmount: {
				"blockbook": peerBlockbookBasedExplorer.getInputAmount('https://blockbook.peercoin.net')
			}
		},
		peercoin_testnet: {
			listUnspent: {
				"blockbook": peerBlockbookBasedExplorer.listUnspent('https://tblockbook.peercoin.net')
			},
			broadcast: {
				"blockbook": peerBlockbookBasedExplorer.broadcast('https://tblockbook.peercoin.net')
			},
			getTransaction: {
				"blockbook": peerBlockbookBasedExplorer.getTransaction('https://tblockbook.peercoin.net')
			},
			getInputAmount: {
				"blockbook": peerBlockbookBasedExplorer.getInputAmount('https://tblockbook.peercoin.net')
			}
		}
	}
	
	/* page load code */

		/* open wallet code */

	$("#openBtn").click(function(){
		var email = $("#openEmail").val().toLowerCase();
		if(email.match(/[\s\w\d]+@[\s\w\d]+/g)){
			if($("#openPass").val().length>=10){
				if($("#openPass").val()==$("#openPassConfirm").val()){
					var email = $("#openEmail").val().toLowerCase();
					var pass = $("#openPass").val();
					var s = email;
					s += '|'+pass+'|';
					s += s.length+'|!@'+((pass.length*7)+email.length)*7;
					var regchars = (pass.match(/[a-z]+/g)) ? pass.match(/[a-z]+/g).length : 1;
					var regupchars = (pass.match(/[A-Z]+/g)) ? pass.match(/[A-Z]+/g).length : 1;
					var regnums = (pass.match(/[0-9]+/g)) ? pass.match(/[0-9]+/g).length : 1;
					s += ((regnums+regchars)+regupchars)*pass.length+'3571';
					s += (s+''+s);

					for(i=0;i<=50;i++){
						s = Crypto.SHA256(s);
					}

					coinjs.compressed = true;
					var keys = coinjs.newKeys(s);
					var address = keys.address;
					var wif = keys.wif;
					var pubkey = keys.pubkey;
					var privkeyaes = CryptoJS.AES.encrypt(keys.wif, pass);

					$("#walletKeys .walletSegWitRS").addClass("hidden");
					if($("#walletSegwit").is(":checked")){
						if($("#walletSegwitBech32").is(":checked")){
							var sw = coinjs.bech32Address(pubkey);
							address = sw.address;
						} else {

							var sw = coinjs.segwitAddress(pubkey);
							address = sw.address;
						}

						$("#walletKeys .walletSegWitRS").removeClass("hidden");
						$("#walletKeys .walletSegWitRS input:text").val(sw.redeemscript);
					}

					$("#walletAddress").html(address);
					$("#walletHistory").attr('href',explorer_addr+address);

					$("#walletQrCode").html("");
					var qrcode = new QRCode("walletQrCode");
					qrcode.makeCode("bitcoin:"+address);

					$("#walletKeys .privkey").val(wif);
					$("#walletKeys .pubkey").val(pubkey);
					$("#walletKeys .privkeyaes").val(privkeyaes);

					$("#openLogin").hide();
					$("#openWallet").removeClass("hidden").show();

					walletBalance();
					checkBalanceLoop();
				} else {
					$("#openLoginStatus").html("Your passwords do not match!").removeClass("hidden").fadeOut().fadeIn();
				}
			} else {
				$("#openLoginStatus").html("Your password must be at least 10 chars long").removeClass("hidden").fadeOut().fadeIn();
			}
		} else {
			$("#openLoginStatus").html("Your email address doesn't appear to be valid").removeClass("hidden").fadeOut().fadeIn();
		}

		$("#openLoginStatus").prepend('<span class="glyphicon glyphicon-exclamation-sign"></span> ');
	});

	$("#walletLogout").click(function(){
		$("#openEmail").val("");
		$("#openPass").val("");
		$("#openPassConfirm").val("");

		$("#openLogin").show();
		$("#openWallet").addClass("hidden").show();

		$("#walletAddress").html("");
//		$("#walletHistory").attr('href',explorer_addr);

		$("#walletQrCode").html("");
		var qrcode = new QRCode("walletQrCode");
		qrcode.makeCode("bitcoin:");

		$("#walletKeys .privkey").val("");
		$("#walletKeys .pubkey").val("");

		$("#openLoginStatus").html("").hide();
	});

	$("#walletSegwit").click(function(){
		if($(this).is(":checked")){
			$(".walletSegwitType").attr('disabled',false);
		} else {
			$(".walletSegwitType").attr('disabled',true);
		}	
	});

	$("#walletToSegWit").click(function(){
		$("#walletToBtn").html('SegWit <span class="caret"></span>');
		$("#walletSegwit")[0].checked = true;
		$("#walletSegwitp2sh")[0].checked = true;
		$("#openBtn").click();
	});

	$("#walletToSegWitBech32").click(function(){
		$("#walletToBtn").html('Bech32 <span class="caret"></span>');
		$("#walletSegwit")[0].checked = true;
		$("#walletSegwitBech32")[0].checked = true;		
		$("#openBtn").click();
	});

	$("#walletToLegacy").click(function(){
		$("#walletToBtn").html('Legacy <span class="caret"></span>');
		$("#walletSegwit")[0].checked = false;
		$("#openBtn").click();
	});

	$("#walletShowKeys").click(function(){
		$("#walletKeys").removeClass("hidden");
		$("#walletSpend").removeClass("hidden").addClass("hidden");
	});

	$("#walletBalance").click(function(){
		walletBalance();
	});

	$("#walletConfirmSend").click(function(){
		var thisbtn = $(this);
		var tx = coinjs.transaction();
		var txfee = $("#txFee");
		/*var devaddr = coinjs.developer;  // TODO: generate address from dev known pubkey
		var devamount = $("#developerDonation");

		if((devamount.val()*1)>0){
			tx.addoutput(devaddr, devamount.val()*1);
		}*/

		var total = (devamount.val()*1) + (txfee.val()*1);

		$.each($("#walletSpendTo .output"), function(i,o){
			var addr = $('.addressTo',o);
			var amount = $('.amount',o);
			total += amount.val()*1;
			tx.addoutput(addr.val(), amount.val()*1);
		});

		thisbtn.attr('disabled',true);

		var script = false;
		if($("#walletSegwit").is(":checked")){
			if($("#walletSegwitBech32").is(":checked")){
				var sw = coinjs.bech32Address($("#walletKeys .pubkey").val());
			} else {
				var sw = coinjs.segwitAddress($("#walletKeys .pubkey").val());
			}
			script = sw.redeemscript;
		}

		var sequence = false;
		if($("#walletRBF").is(":checked")){
			sequence = 0xffffffff-2;
		}

		tx.addUnspent($("#walletAddress").html(), function(data){
			var dvalue = data.value/("1e"+coinjs.decimalPlaces);
			total = (total*1).toFixed(coinjs.decimalPlaces) * 1;

			if(dvalue>=total){
				var change = dvalue-total;
				if((change*1)>0){
					tx.addoutput($("#walletAddress").html(), change);
				}

				// clone the transaction with out using coinjs.clone() function as it gives us trouble
				var tx2 = coinjs.transaction(); 
				var txunspent = tx2.deserialize(tx.serialize()); 

				// then sign
				var signed = txunspent.sign($("#walletKeys .privkey").val());

				// and finally broadcast!
				/*
				tx2.broadcast(function(data){
					if($(data).find("result").text()=="1"){
						$("#walletSendConfirmStatus").removeClass('hidden').addClass('alert-success').html("txid: "+$(data).find("txid").text());
					} else {
						$("#walletSendConfirmStatus").removeClass('hidden').addClass('alert-danger').html(unescape($(data).find("response").text()).replace(/\+/g,' '));
						thisbtn.attr('disabled',false);
					}

					// update wallet balance
					walletBalance();

				}, signed);
				*/
			} else {
				$("#walletSendConfirmStatus").removeClass("hidden").addClass('alert-danger').html("You have a confirmed balance of "+dvalue+" BTC unable to send "+total+" BTC").fadeOut().fadeIn();
				thisbtn.attr('disabled',false);
			}

			$("#walletLoader").addClass("hidden");

		}, script, script, sequence);
	});

	$("#walletSendBtn").click(function(){

		$("#walletSendFailTransaction").addClass('hidden');
		$("#walletSendStatus").addClass("hidden").html("");

		var thisbtn = $(this);
		var txfee = $("#txFee");
		var devamount = $("#developerDonation");

		if((!isNaN(devamount.val())) && devamount.val()>=0){
			$(devamount).parent().removeClass('has-error');
		} else {
			$(devamount).parent().addClass('has-error')
		}

		if((!isNaN(txfee.val())) && txfee.val()>=0){
			$(txfee).parent().removeClass('has-error');
		} else {
			$(txfee).parent().addClass('has-error');
		}

		var total = (devamount.val()*1) + (txfee.val()*1);

		$.each($("#walletSpendTo .output"), function(i,o){
			var amount = $('.amount',o);
			var address = $('.addressTo',o);

			total += amount.val()*1;

			if((!isNaN($(amount).val())) && $(amount).val()>0){
				$(amount).parent().removeClass('has-error');
			} else {
				$(amount).parent().addClass('has-error');			
			}

			if(coinjs.addressDecode($(address).val())){
				$(address).parent().removeClass('has-error');
			} else {
				$(address).parent().addClass('has-error');
			}
		});

		total = total.toFixed(coinjs.decimalPlaces);

		if($("#walletSpend .has-error").length==0){
			var balance = ($("#walletBalance").html()).replace(/[^0-9\.]+/g,'')*1;
			if(total<=balance){
				$("#walletSendConfirmStatus").addClass("hidden").removeClass('alert-success').removeClass('alert-danger').html("");
				$("#spendAmount").html(total);
				$("#modalWalletConfirm").modal("show");
				$("#walletConfirmSend").attr('disabled',false);
			} else {
				$("#walletSendStatus").removeClass("hidden").html("You are trying to spend "+total+' but have a balance of '+balance);
			}
		} else {
			$("#walletSpend .has-error").fadeOut().fadeIn();
			$("#walletSendStatus").removeClass("hidden").html('<span class="glyphicon glyphicon-exclamation-sign"></span> One or more input has an error');
		}
	});

	$("#walletShowSpend").click(function(){
		$("#walletSpend").removeClass("hidden");
		$("#walletKeys").removeClass("hidden").addClass("hidden");
	});

	$("#walletSpendTo .addressAdd").click(function(){
		var clone = '<div class="form-horizontal output">'+$(this).parent().html()+'</div>';
		$("#walletSpendTo").append(clone);
		$("#walletSpendTo .glyphicon-plus:last").removeClass('glyphicon-plus').addClass('glyphicon-minus');
		$("#walletSpendTo .glyphicon-minus:last").parent().removeClass('addressAdd').addClass('addressRemove');
		$("#walletSpendTo .addressRemove").unbind("");
		$("#walletSpendTo .addressRemove").click(function(){
			$(this).parent().fadeOut().remove();
		});
	});


	/* new -> address code */

	$("#ledgerKeysBtn").click(function(){
		if($("#newBrainwallet").is(":checked")) {
				signWithLedgerAddress($("#brainwallet").val(),function(result) {
				console.log("signature:",coinjs.ledgerPath,result);
			});
		} else
			getLedgerAddress("legacy", function(result) {
				coinjs.compressed = false;
				if($("#newCompressed").is(":checked")){
					coinjs.compressed = true;
				}
				console.log("address:",coinjs.ledgerPath,result);
				$("#newGeneratedAddress").val(result.bitcoinAddress);
				$("#newPubKey").val((coinjs.compressed) ? coinjs.pubkeycompress(result.publicKey) : result.publicKey);
			}); 
	});

	$("#newKeysBtn").click(function(){
		coinjs.compressed = false;
		if($("#newCompressed").is(":checked")){
			coinjs.compressed = true;
		}
		var s = ($("#newBrainwallet").is(":checked")) ? $("#brainwallet").val() : null;
		var coin = coinjs.newKeys(s, ($("#newBrainwallet").is(":checked") && $("#brainwalletIsPrivKey").is(":checked")));
		$("#newGeneratedAddress").val(coin.address);
		$("#newPubKey").val(coin.pubkey);
		$("#newPrivKeyWif").val(coin.wif);
		$("#newPrivKey").val(coin.privkey);
//todo new		$("#newPrivKey").val(coin.wif);

		/* encrypted key code */
		if((!$("#encryptKey").is(":checked")) || $("#aes256pass").val()==$("#aes256pass_confirm").val()){
			$("#aes256passStatus").addClass("hidden");
			if($("#encryptKey").is(":checked")){
				$("#aes256wifkey").removeClass("hidden");
			}
		} else {
			$("#aes256passStatus").removeClass("hidden");
		}
		$("#newPrivKeyEnc").val(CryptoJS.AES.encrypt(coin.wif, $("#aes256pass").val())+'');
	});

	$("#newPaperwalletBtn").click(function(){
		if($("#newBitcoinAddress").val()==""){
			$("#newKeysBtn").click();
		}

		var paperwallet = window.open();
		paperwallet.document.write('<h2>BTC PaperWallet</h2><hr><div style="margin-top: 5px; margin-bottom: 5px"><div><h3 style="margin-top: 0">Address (Share)</h3></div><div style="text-align: center;"><div id="qraddress"></div><p>'+$("#newBitcoinAddress").val()+'</p></div></div><hr><div style="margin-top: 5px; margin-bottom: 5px"><div><h3 style="margin-top: 0">Public Key</h3></div><div style="text-align: center;"><div id="qrpubkey"></div><p>'+$("#newPubKey").val()+'</p></div></div><hr><div style="margin-top: 5px; margin-bottom: 5px"><div><h3 style="margin-top: 0">Private Key (KEEP SECRET!)</h3></div><div style="text-align: center;"><div id="qrprivkey"></div><p>'+$("#newPrivKey").val()+'</p></div></div>');
		paperwallet.document.close();
		paperwallet.focus();
		new QRCode(paperwallet.document.getElementById("qraddress"), {text: $("#newBitcoinAddress").val(), width: 125, height: 125});
		new QRCode(paperwallet.document.getElementById("qrpubkey"), {text: $("#newPubKey").val(), width: 125, height: 125});
		new QRCode(paperwallet.document.getElementById("qrprivkey"), {text: $("#newPrivKey").val(), width: 125, height: 125});
		paperwallet.print();
		paperwallet.close();
	});

	$("#newBrainwallet").click(function(){
		if($(this).is(":checked")){
			$("#brainwallet").removeClass("hidden");
		} else {
			$("#brainwallet").addClass("hidden");
		}
	});

	$("#newSegWitBrainwallet").click(function(){
		if($(this).is(":checked")){
			$("#brainwalletSegWit").removeClass("hidden");
		} else {
			$("#brainwalletSegWit").addClass("hidden");
		}
	});

	$("#encryptKey").click(function(){
		if($(this).is(":checked")){
			$("#aes256passform").removeClass("hidden");
		} else {
			$("#aes256wifkey, #aes256passform, #aes256passStatus").addClass("hidden");
		}
	});

	/* new -> segwit code */
	$("#newSegWitKeysBtn").click(function(){
		var compressed = coinjs.compressed;
		coinjs.compressed = true;

		var s = ($("#newSegWitBrainwallet").is(":checked")) ? $("#brainwalletSegWit").val() : null;
		var coin = coinjs.newKeys(s);

		if($("#newSegWitBech32addr").is(":checked")){
			var sw = coinjs.bech32Address(coin.pubkey);
		} else {
			var sw = coinjs.segwitAddress(coin.pubkey);
		}

		$("#newSegWitAddress").val(sw.address);
		$("#newSegWitRedeemScript").val(sw.redeemscript);
		$("#newSegWitPubKey").val(coin.pubkey);
		$("#newSegWitPrivKey").val(coin.wif);
		coinjs.compressed = compressed;
	});

	$("#newSegwitPaperwalletBtn").click(function(){
		if($("#newSegWitAddress").val()==""){
			$("#newSegWitKeysBtn").click();
		}

		var paperwallet = window.open();
		paperwallet.document.write('<h2>BTC SegWit PaperWallet</h2><hr><div style="margin-top: 5px; margin-bottom: 5px"><div><h3 style="margin-top: 0">Address (Share)</h3></div><div style="text-align: center;"><div id="qraddress"></div><p>'+$("#newSegWitAddress").val()+'</p></div></div><hr><div style="margin-top: 5px; margin-bottom: 5px"><div><h3 style="margin-top: 0">Public Key</h3></div><div style="text-align: center;"><div id="qrpubkey"></div><p>'+$("#newSegWitPubKey").val()+'</p></div></div><hr><div style="margin-top: 5px; margin-bottom: 5px"><div><h3 style="margin-top: 0">Redeem Script</h3></div><div style="text-align: center;"><div id="qrredeem"></div><p>'+$("#newSegWitRedeemScript").val()+'</p></div></div><hr><div style="margin-top: 5px; margin-bottom: 5px"><div><h3 style="margin-top: 0">Private Key (KEEP SECRET!)</h3></div><div style="text-align: center;"><div id="qrprivkey"></div><p>'+$("#newSegWitPrivKey").val()+'</p></div></div>');
		paperwallet.document.close();
		paperwallet.focus();
		new QRCode(paperwallet.document.getElementById("qraddress"), {text: $("#newSegWitAddress").val(), width: 110, height: 110});
		new QRCode(paperwallet.document.getElementById("qrpubkey"), {text: $("#newSegWitPubKey").val(), width: 110, height: 110});
		new QRCode(paperwallet.document.getElementById("qrredeem"), {text: $("#newSegWitRedeemScript").val(), width: 110, height: 110});
		new QRCode(paperwallet.document.getElementById("qrprivkey"), {text: $("#newSegWitPrivKey").val(), width: 110, height: 110});
		paperwallet.print();
		paperwallet.close();
	});

	/* new -> multisig code */

	$("#newMultiSigAddress").click(function(){

		$("#multiSigData").removeClass('show').addClass('hidden').fadeOut();
		$("#multisigPubKeys .pubkey").parent().removeClass('has-error');
		$("#releaseCoins").parent().removeClass('has-error');
		$("#multiSigErrorMsg").hide();

		if((isNaN($("#releaseCoins option:selected").html())) || ((!isNaN($("#releaseCoins option:selected").html())) && ($("#releaseCoins option:selected").html()>$("#multisigPubKeys .pubkey").length || $("#releaseCoins option:selected").html()*1<=0 || $("#releaseCoins option:selected").html()*1>8))){
			$("#releaseCoins").parent().addClass('has-error');
			$("#multiSigErrorMsg").html('<span class="glyphicon glyphicon-exclamation-sign"></span> Minimum signatures required is greater than the amount of public keys provided').fadeIn();
			return false;
		}

		var keys = [];
		$.each($("#multisigPubKeys .pubkey"), function(i,o){
			if(coinjs.pubkeydecompress($(o).val())){
				keys.push($(o).val());
				$(o).parent().removeClass('has-error');
			} else {
				$(o).parent().addClass('has-error');
			}
		});

		if(($("#multisigPubKeys .pubkey").parent().hasClass('has-error')==false) && $("#releaseCoins").parent().hasClass('has-error')==false){
			var sigsNeeded = $("#releaseCoins option:selected").html();
			var multisig =  coinjs.pubkeys2MultisigAddress(keys, sigsNeeded);
			//todo there was no size check in toolkit
			if(multisig.size <= 520){
				$("#multiSigData .address").val(multisig['address']);
				$("#multiSigData .script").val(multisig['redeemScript']);
				$("#multiSigData .scriptUrl").val(document.location.origin+''+document.location.pathname+'?mode='+$("#coinSelector").val()+'&verify='+multisig['redeemScript']+'#verify');
				$("#multiSigData").removeClass('hidden').addClass('show').fadeIn();
				$("#releaseCoins").removeClass('has-error');
			} else {
				$("#multiSigErrorMsg").html('<span class="glyphicon glyphicon-exclamation-sign"></span> Your generated redeemscript is too large (>520 bytes) it can not be used safely').fadeIn();
			}
		} else {
			$("#multiSigErrorMsg").html('<span class="glyphicon glyphicon-exclamation-sign"></span> One or more public key is invalid!').fadeIn();
		}
	});

	$("#newMultiSigAddressSort").click(function(){
		var mylist = $("#multisigPubKeys .sort");
		var listitems = mylist.children();
		listitems.sort(function(a, b) {
		   var compA = $(a).find('.pubkey').val().toUpperCase();
		   var compB = $(b).find('.pubkey').val().toUpperCase();
		   return (compA < compB) ? -1 : (compA > compB) ? 1 : 0;
		})
		$.each(listitems, function(idx, itm) {
			mylist.append(itm);
		});
		$("#multiSigData").addClass("hidden");
	});
	
	$("#multisigPubKeys .list").on('input change', '.pubkey', function() {
		var val = (known.pubKey[$(this).val()])?known.pubKey[$(this).val()].name:'';
		$(this).parent().parent().find('.id').val(val)
	});

	$("#multisigPubKeys .list")
	.on('click', '.pubkeyAdd', function(){
		if($("#multisigPubKeys .list .pubkeyRemove").length<14){
			var clone = $(this).parent().parent().clone();
			$(this).parent().parent().after(clone);
			$(clone).find('.pubkey').val('').change();
		}
		$("#multiSigData").addClass("hidden");
	})
	.on('click', '.pubkeyRemove', function(){
		$(this).parent().parent().remove();
		$("#multiSigData").addClass("hidden");
	});
/*
	$("#mediatorList").change(function(){
		var data = ($(this).val()).split(";");
		$("#mediatorPubkey").val(data[0]);
		$("#mediatorEmail").val(data[1]);
		$("#mediatorFee").val(data[2]);
	}).change();
*/
	$("#mediatorAddKey").click(function(){
		var count = 0;
		var len = $(".pubkeyRemove").length;
		if(len<14){
			$.each($("#multisigPubKeys .pubkey"),function(i,o){
				if($(o).val()==''){
					$(o).val($("#mediatorPubkey").val()).fadeOut().fadeIn();
					$("#mediatorClose").click();
					return false;
				} else if(count==len){
					$("#multisigPubKeys .pubkeyAdd").click();
					$("#mediatorAddKey").click();
					return false;
				}
				count++;
			});

			$("#mediatorClose").click();
		}
	});

	/* new -> time locked code */

	$('#timeLockedDateTimePicker').datetimepicker({
		format: "MM/DD/YYYY HH:mm",
	});
	
	$('#timeLockedRbTypeBox input').change(function(){
		if ($('#timeLockedRbTypeDate').is(':checked')){
			$('#timeLockedDateTimePicker').show();
			$('#timeLockedBlockHeight').hide();
		} else {
			$('#timeLockedDateTimePicker').hide();
			$('#timeLockedBlockHeight').removeClass('hidden').show();
		}
	});

    $("#newTimeLockedAddress").click(function(){

        $("#timeLockedData").removeClass('show').addClass('hidden').fadeOut();
        $("#timeLockedPubKey").parent().removeClass('has-error');
        $("#timeLockedDateTimePicker").parent().removeClass('has-error');
        $("#timeLockedErrorMsg").hide();

        if(!coinjs.pubkeydecompress($("#timeLockedPubKey").val())) {
        	$('#timeLockedPubKey').parent().addClass('has-error');
        }

        var nLockTime = -1;

        if ($('#timeLockedRbTypeDate').is(':checked')){
        	// by date
	        var date = $('#timeLockedDateTimePicker').data("DateTimePicker").date();
	        if(!date || !date.isValid()) {
	        	$('#timeLockedDateTimePicker').parent().addClass('has-error');
	        }
	        nLockTime = date.unix()
	        if (nLockTime < 500000000) {
	        	$('#timeLockedDateTimePicker').parent().addClass('has-error');
	        }
        } else {
			nLockTime = parseInt($('#timeLockedBlockHeightVal').val(), 10);
	        if (nLockTime >= 500000000) {
	        	$('#timeLockedDateTimePicker').parent().addClass('has-error');
	        }
        }

        if(($("#timeLockedPubKey").parent().hasClass('has-error')==false) && $("#timeLockedDateTimePicker").parent().hasClass('has-error')==false){
        	try {
	            var hodl = coinjs.simpleHodlAddress($("#timeLockedPubKey").val(), nLockTime);
	            $("#timeLockedData .address").val(hodl['address']);
	            $("#timeLockedData .script").val(hodl['redeemScript']);
	            $("#timeLockedData .scriptUrl").val(document.location.origin+''+document.location.pathname+'?verify='+hodl['redeemScript']+'#verify');
	            $("#timeLockedData").removeClass('hidden').addClass('show').fadeIn();
	        } catch(e) {
	        	$("#timeLockedErrorMsg").html('<span class="glyphicon glyphicon-exclamation-sign"></span> ' + e).fadeIn();
	        }
        } else {
            $("#timeLockedErrorMsg").html('<span class="glyphicon glyphicon-exclamation-sign"></span> Public key and/or date is invalid!').fadeIn();
        }
    });

	/* new -> Hd address code */

	$(".deriveHDbtn").click(function(){
		$("#verifyScript").val($("input[type='text']",$(this).parent().parent()).val());
		window.location = "#verify";
		$("#verifyBtn").click();
	});

	$("#newHDKeysBtn").click(function(){
		coinjs.compressed = true;
		var s = ($("#newHDBrainwallet").is(":checked")) ? $("#HDBrainwallet").val() : null;
		var hd = coinjs.hd();
		var pair = hd.master(s);
		$("#newHDxpub").val(pair.pubkey);
		$("#newHDxprv").val(pair.privkey);

	});

	$("#newHDBrainwallet").click(function(){
		if($(this).is(":checked")){
			$("#HDBrainwallet").removeClass("hidden");
		} else {
			$("#HDBrainwallet").addClass("hidden");
		}
	});

	/* new -> transaction code */

	$("#recipients").on('input change', '.address', function() {
		var addr = $(this).val();
		var identity = '';
		var details = coinjs.addressDecode(addr);
		if (details.type == 'standard') {
			$.each(known.pubKey, function(pubkey, id) {
				if (coinjs.pubkey2address(pubkey, coinjs.pub) == addr) {
					identity = known.pubKey[pubkey].name;
					return false;
				}
			});
		} else if (details.type == 'multisig') {
			$.each(known.scriptHash, function(scripthash, id) {
				if (coinjs.scripthash2address(scripthash, coinjs.multisig) == addr) {
					identity = known.scriptHash[scripthash].name;
					return false;
				}
			});
		}

		$(this).parent().parent().find('.id').val(identity);
	});

	$("#recipients .addressAddTo").click(function(){
		if($("#recipients .addressRemoveTo").length<99){
			var clone = '<div class="row recipient"><br>'+$(this).parent().parent().html()+'</div>';
			$("#recipients").append(clone);
			$("#recipients .glyphicon-plus:last").removeClass('glyphicon-plus').addClass('glyphicon-minus');
			$("#recipients .glyphicon-minus:last").parent().removeClass('addressAdd').addClass('addressRemoveTo');
			$("#recipients .addressRemoveTo").unbind("");
			$("#recipients .addressRemoveTo").click(function(){
				$(this).parent().parent().fadeOut().remove();
				validateOutputAmount();
			});
			validateOutputAmount();
		}
	});

	$("#inputs").on('click', '.txidAdd', function(){
		var clone = $(this).parent().parent().clone();
		$("input", clone).attr('disabled', false).val("");
		$(this).parent().parent().after(clone);
	});

	$("#inputs").on('click', '.txidRemove', function(){
		if ($("#inputs .txidRemove").length < 2) return;
		$(this).parent().parent().fadeOut().remove();
		totalInputAmount();
	});

	$("#inputs").on('input change', ".txIdAmount", function(){
		totalInputAmount();
	}).keyup(function(){
		totalInputAmount();
	});

	$("#transactionBtn").click(function(){
		var tx = coinjs.transaction();
		var estimatedTxSize = 10; // <4:version><1:txInCount><1:txOutCount><4:nLockTime>

		$("#transactionCreate, #transactionCreateStatus").addClass("hidden");

		if(($("#nLockTime").val()).match(/^[0-9]+$/g)){
			tx.lock_time = $("#nLockTime").val()*1;
		}

		if(($("#nTime").val()).match(/^[0-9]+$/g)){
			tx.nTime = $("#nTime").val()*1;
		}

		$("#inputs .row").removeClass('has-error');

		$('#putTabs a[href="#txinputs"], #putTabs a[href="#txoutputs"]').attr('style','');

		$.each($("#inputs .row"), function(i,o){
			if(!($(".txId",o).val()).match(/^[a-f0-9]+$/i)){
				$(o).addClass("has-error");
			} else if(!($(".txIdScript",o).val()).match(/^[a-f0-9]+$/i) || $(".txIdScript",o).val()==""){
// todo in toolkit			} else if((!($(".txIdScript",o).val()).match(/^[a-f0-9]+$/i)) && $(".txIdScript",o).val()!=""){
				$(o).addClass("has-error");
			} else if (!($(".txIdN",o).val()).match(/^[0-9]+$/i)){
				$(o).addClass("has-error");
			}

			if(!$(o).hasClass("has-error")){
				var seq = null;
				if($("#txRBF").is(":checked")){
					seq = 0xffffffff-2;
				}

				var currentScript = $(".txIdScript",o).val();
				if (currentScript.match(/^76a914[0-9a-f]{40}88ac$/)) {
					estimatedTxSize += 147
				} else if (currentScript.match(/^5[1-9a-f](?:210[23][0-9a-f]{64}){1,15}5[1-9a-f]ae$/)) {
					// <74:persig <1:push><72:sig><1:sighash> ><34:perpubkey <1:push><33:pubkey> > <32:prevhash><4:index><4:nSequence><1:m><1:n><1:OP>
					var scriptSigSize = (parseInt(currentScript.slice(1,2),16) * 74) + (parseInt(currentScript.slice(-3,-2),16) * 34) + 43
					// varint 2 bytes if scriptSig is > 252
					estimatedTxSize += scriptSigSize + (scriptSigSize > 252 ? 2 : 1)
				} else {
					// underestimating won't hurt. Just showing a warning window anyways.
					estimatedTxSize += 147
				}

				tx.addinput($(".txId",o).val(), $(".txIdN",o).val(), $(".txIdScript",o).val(), seq);
			} else {
				$('#putTabs a[href="#txinputs"]').attr('style','color:#a94442;');
			}
		});

		$("#recipients .row").removeClass('has-error');

		$.each($("#recipients .row"), function(i,o){
			var a = ($(".address",o).val());
			var ad = coinjs.addressDecode(a);
			if(((a!="") && (ad.version == coinjs.pub || ad.version == coinjs.multisig || ad.type=="bech32")) && $(".amount",o).val()!=""){ // address
				// P2SH output is 32, P2PKH is 34
				estimatedTxSize += (ad.version == coinjs.pub ? 34 : 32)
				tx.addoutput(a, $(".amount",o).val());
			} else if (((a!="") && ad.version === 42) && $(".amount",o).val()!=""){ // stealth address
				// 1 P2PKH and 1 OP_RETURN with 36 bytes, OP byte, and 8 byte value
				estimatedTxSize += 78
				tx.addstealth(ad, $(".amount",o).val());
			} else if ($("#opReturn").is(":checked")) { // data
				if ($("#opReturnText").is(":checked")) {
					tx.addTextData(a);
				} else {
					tx.addHexData(a);
				}
			} else if (((($("#opReturn").is(":checked")) && a.match(/^[a-f0-9]+$/ig)) && a.length<160) && (a.length%2)==0) { // data
				estimatedTxSize += (a.length / 2) + 1 + 8
				tx.adddata(a);
			} else { // neither address nor data
				$(o).addClass('has-error');
				$('#putTabs a[href="#txoutputs"]').attr('style','color:#a94442;');
			}
		});


		if(!$("#recipients .row, #inputs .row").hasClass('has-error')){
			$("#transactionCreate textarea").val(tx.serialize());
			$("#transactionCreate .txSize").html(tx.size());

			$("#transactionCreate .transactionToSign").on( "click", function() {
				$("#signTransaction").val(tx.serialize()).fadeOut().fadeIn();;
				window.location.hash = "#sign";
			});

			$("#transactionCreate .transactionToVerify").on( "click", function() {
				$("#verifyScript").val(tx.serialize()).fadeOut().fadeIn();;
				window.location.hash = "#verify";
				$("#verifyBtn").click();
			});

			$("#transactionCreate").removeClass("hidden");

			if ($("#coinSelector").val() == "peercoin" || $("#coinSelector").val() == "peercoin_testnet") {
				if ($("#transactionFee").val()>=0.1){
					$("#modalWarningFeeAmount").html($("#transactionFee").val());
					$("#modalWarningFee").modal("show");
				}	
			}
			else {
				if ($("#transactionFee").val()>=0.011){
					$("#modalWarningFeeAmount").html($("#transactionFee").val());
					$("#modalWarningFee").modal("show");
				}
			}
		} else {
			$("#transactionCreateStatus").removeClass("hidden").html("One or more input or output is invalid").fadeOut().fadeIn();
		}
	});

	$("#inputs .txIdAmount").unbind("").change(function(){
		totalInputAmount();
	}).keyup(function(){
		totalInputAmount();
	});

	/* code for the qr code scanner */

	$(".qrcodeScanner").click(function(){
		if ((typeof MediaStreamTrack === 'function') && typeof MediaStreamTrack.getSources === 'function'){
			MediaStreamTrack.getSources(function(sourceInfos){
				var f = 0;
				$("select#videoSource").html("");
				for (var i = 0; i !== sourceInfos.length; ++i) {
					var sourceInfo = sourceInfos[i];
					var option = document.createElement('option');
					option.value = sourceInfo.id;
					if (sourceInfo.kind === 'video') {
						option.text = sourceInfo.label || 'camera ' + ($("select#videoSource options").length + 1);
						$(option).appendTo("select#videoSource");
					}
				}
			});

			$("#videoSource").unbind("change").change(function(){
				scannerStart()
			});

		} else {
			$("#videoSource").addClass("hidden");
		}
		scannerStart();
		$("#qrcode-scanner-callback-to").html($(this).attr('forward-result'));
	});

	/* code for the script decoder */

	$(".scriptDecoder").click(function(){
		if ((typeof MediaStreamTrack === 'function') && typeof MediaStreamTrack.getSources === 'function'){
			MediaStreamTrack.getSources(function(sourceInfos){
				var f = 0;
				$("select#videoSource").html("");
				for (var i = 0; i !== sourceInfos.length; ++i) {
					var sourceInfo = sourceInfos[i];
					var option = document.createElement('option');
					option.value = sourceInfo.id;
					if (sourceInfo.kind === 'video') {
						option.text = sourceInfo.label || 'camera ' + ($("select#videoSource options").length + 1);
						$(option).appendTo("select#videoSource");
					}
				}
			});

			$("#videoSource").unbind("change").change(function(){
				scannerStart()
			});

		} else {
			$("#videoSource").addClass("hidden");
		}
		scannerStart();
		$("#qrcode-scanner-callback-to").html($(this).attr('forward-result'));
	});
	
	/* broadcast code */
	$("#rawSubmitBtn").click(function(){
		var host = $(this).attr('rel');
		providers[$("#coinSelector").val()].broadcast[host](this);
	});
	
	/* trim user's input */
	$("#redeemFrom").focusout(function(){
		$(this).val($(this).val().replace(/\s/g, ""));
	});

	$("#verifyScript").focusout(function(){
		$(this).val($(this).val().replace(/\s/g, ""));
	});

	/* redeem from button code */
	$("#redeemFromBtn").click(function(){
		var redeem = redeemingFrom($("#redeemFrom").val());

		$("#redeemFromStatus, #redeemFromAddress").addClass('hidden');

		if(redeem.from=='multisigAddress'){
			$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> This is a multisig address. You must use the redeem script, not the multisig address!');
			return false;
		}

		if(redeem.from=='other'){
			$("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> The address or multisig redeem script you have entered is invalid');
			return false;
		}

		if($("#clearInputsOnLoad").is(":checked")){
			$("#inputs .txidAdd:last").click();
			$("#inputs .txidRemove:not(:last)").click();
		}

		$("#redeemFromBtn").html('Please wait, loading... <span class="glyphicon glyphicon-refresh glyphicon-refresh-animate"></span>').attr('disabled',true);

		var host = $(this).attr('rel');
		providers[$("#coinSelector").val()].listUnspent[host](redeem);

		if($("#redeemFromStatus").hasClass("hidden")) {
			// An ethical dilemma: Should we automatically set nLockTime?
			if(redeem.from == 'redeemScript' && redeem.type == "hodl__") {
				$("#nLockTime").val(redeem.decodescript.checklocktimeverify);
			} else {
				$("#nLockTime").val(0);
			}
		}
	});

	$("#opReturn").change(function() {
		if ($(this).is(":checked")) {
			$("#opReturnText")
				.removeAttr("disabled")
				.parent()
				.removeAttr("disabled");
		} else {
			$("#opReturnText")
				.prop("checked", false)
				.attr("disabled", true)
				.change()
				.parent()
				.attr("disabled", true);
		}
	});

	$("#opReturnText").change(function() {
		if ($(this).is(":checked")) {
			$("#opReturnMessage").addClass("hidden");
			$("#opReturnTextMessage").removeClass("hidden");
		} else {
			$("#opReturnMessage").removeClass("hidden");
			$("#opReturnTextMessage").addClass("hidden");
		}
	});

	$("#optionsCollapse").click(function(){
		if($("#optionsAdvanced").hasClass('hidden')){
			$("#glyphcollapse").removeClass('glyphicon-collapse-down').addClass('glyphicon-collapse-up');
			$("#optionsAdvanced").removeClass("hidden");
		} else {
			$("#glyphcollapse").removeClass('glyphicon-collapse-up').addClass('glyphicon-collapse-down');
			$("#optionsAdvanced").addClass("hidden");
		}
	});

	/* verify script code */

	$("#verifyBtn").click(function(){
		$(".verifyData").addClass("hidden");
		$("#verifyStatus").hide();
		if(!decodeRedeemScript()){
			if(!decodeTransactionScript()){
				if(!decodePrivKey()){
					if(!decodePubKey()){
						if(!decodeHDaddress()){
							$("#verifyStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unable to decode').fadeOut().fadeIn();
						}
					}
				}
			}
		}

	});

	/* sign code */

	$("#signBtn").click(function(){
		var wifkey = $("#signPrivateKey");
		var script = $("#signTransaction");

		if(coinjs.addressDecode(wifkey.val())){
			$(wifkey).parent().removeClass('has-error');
		} else {
			$(wifkey).parent().addClass('has-error');
		}

		if((script.val()).match(/^[a-f0-9]+$/ig)){
			$(script).parent().removeClass('has-error');
		} else {
			$(script).parent().addClass('has-error');
		}

		if($("#sign .has-error").length==0){
			$("#signedDataError").addClass('hidden');
			try {
				var tx = coinjs.transaction();
				var t = tx.deserialize(script.val());

//				var signed = t.sign(wifkey.val());
				var signed = t.sign(wifkey.val(), $("#sighashType option:selected").val());
				$("#signedData textarea").val(signed);
				$("#signedData .txSize").html(t.size());
				$("#signedData").removeClass('hidden').fadeIn();

				$("#signedData .signedToVerify").on( "click", function() {
					$("#verifyScript").val(signed).fadeOut().fadeIn();
					$("#verifyBtn").click();
					window.location.hash = "#verify";
				});

				$("#signedData .signedToBroadcast").on( "click", function() {
					$("#broadcast #rawTransaction").val(signed).fadeOut().fadeIn();
					window.location.hash = "#broadcast";
				});
			} catch(e) {
				if (coinjs.debug) {console.log(e.stack)};
				$("#signedDataError").removeClass('hidden').delay(2000).queue(function(){
					$(this).addClass("hidden").dequeue();
				});
				$("#signedData").addClass('hidden');
			}
		} else {
			$("#signedDataError").removeClass('hidden').delay(2000).queue(function(){
				$(this).addClass("hidden").dequeue();
			});
			$("#signedData").addClass('hidden');
		}
	});


	$("#signLedgerBtn").click(function(){
		var script = $("#signTransaction");

		if((script.val()).match(/^[a-f0-9]+$/ig)){
			$(script).parent().removeClass('has-error');
		} else {
			$(script).parent().addClass('has-error');
		}

		if($("#sign .has-error").length==0){
			$("#signedDataError").addClass('hidden');
			try {
				var tx = coinjs.transaction();
				var t = tx.deserialize(script.val());

				getLedgerSignatures(t, $("#sighashType option:selected").val(), function(result) {
					if (result) {
						$("#signedData textarea").val(result);
						$("#signedData .txSize").html(result.length/2);
						$("#signedData").removeClass('hidden').fadeIn();
						}
					});

				$("#signedData .signedToVerify").on( "click", function() {
					$("#verifyScript").val($("#signedData textarea").val()).fadeOut().fadeIn();
					$("#verifyBtn").click();
					window.location.hash = "#verify";
				});

				$("#signedData .signedToBroadcast").on( "click", function() {
					$("#broadcast #rawTransaction").val(signed).fadeOut().fadeIn();
					window.location.hash = "#broadcast";
				});
			} catch(e) {
				if (coinjs.debug) {console.log(e.stack)};
				$("#signedDataError").removeClass('hidden').delay(2000).queue(function(){
					$(this).addClass("hidden").dequeue();
				});
				$("#signedData").addClass('hidden');
			}
		} else {
			$("#signedDataError").removeClass('hidden').delay(2000).queue(function(){
				$(this).addClass("hidden").dequeue();
			});
			$("#signedData").addClass('hidden');
		}
	});

	/* settings page code */

	$("#coinjs_pub").val('0x'+(coinjs.pub).toString(16));
	$("#coinjs_priv").val('0x'+(coinjs.priv).toString(16));
	$("#coinjs_multisig").val('0x'+(coinjs.multisig).toString(16));

	$("#coinjs_hdpub").val('0x'+(coinjs.hdkey.pub).toString(16));
	$("#coinjs_hdprv").val('0x'+(coinjs.hdkey.prv).toString(16));	

	$("#settingsBtn").click(function(){

		// log out of openwallet
		$("#walletLogout").click();
		
		$("#newGeneratedAddress, #newPubKey, #newPrivKeyWif, #newPrivKey, #newHDxpub, #newHDxprv").val("");
		$("#multiSigData, .verifyData").removeClass('show').addClass('hidden');

		$("#statusSettings").removeClass("alert-success").removeClass("alert-danger").addClass("hidden").html("");
		$("#settings .has-error").removeClass("has-error");

		$.each($(".coinjssetting"),function(i, o){
			if ($(o).hasClass("boolisvalid")) {
				if(!$(o).val().match(/^0x[0-9a-f]+|false$/)){
					$(o).parent().addClass("has-error");
				}
			} else {
				if(!$(o).val().match(/^0x[0-9a-f]+$/)){
					$(o).parent().addClass("has-error");
				}
			}
		});

		if($("#settings .has-error").length==0){

			coinjs.pub =  $("#coinjs_pub").val()*1;
			coinjs.priv =  $("#coinjs_priv").val()*1;
			coinjs.multisig =  $("#coinjs_multisig").val()*1;

			coinjs.hdkey.pub =  $("#coinjs_hdpub").val()*1;
			coinjs.hdkey.prv =  $("#coinjs_hdprv").val()*1;

			coinjs.txExtraTimeField = ($("#coinjs_extratimefield").val() == "true");
			if (coinjs.txExtraTimeField) {
				$("#nTime").val(Date.now() / 1000 | 0);
				$("#txTimeOptional").show();
				$("#verifyTransactionData .txtime").show();
			} else {
				$("#txTimeOptional").hide();
				$("#verifyTransactionData .txtime").hide();
			}
			
			coinjs.txExtraUnitField = ($("#coinjs_extraunitfieldvalue").val() !== "false");
			if (coinjs.txExtraUnitField) {
				coinjs.txExtraUnitFieldValue = $("#coinjs_extraunitfieldvalue").val()*1;
				$("#verifyTransactionData .txunit").show();
			} else {
				$("#verifyTransactionData .txunit").hide();
			}
			
			coinjs.decimalPlaces = $("#coinjs_decimalplaces").val()*1;

			coinjs.symbol = $("#coinjs_symbol").val();
			coinjs.bip44 = $("#coinjs_bip44").val()*1;
			coinjs.ledgerPath = $("#coinjs_ledger").val();
			coinjs.bech32.hrp = $("#coinjs_bech32").val()
			
			$("#rawSubmitBtn").attr('rel',$("#coinjs_broadcast option:selected").val());
			$("#redeemFromBtn").attr('rel',$("#coinjs_utxo option:selected").val());
			
			toolkit.getInputAmount = $("#coinjs_getinputamount option:selected").val();
			toolkit.getTransaction = $("#coinjs_gettransaction option:selected").val();
			
			$("#coinSelector").val($("#coinjs_coin").val());

			$("#statusSettings").addClass("alert-success").removeClass("hidden").html("<span class=\"glyphicon glyphicon-ok\"></span> Settings updated successfully").fadeOut().fadeIn().delay(2000).fadeOut(); ;	
		} else {
			$("#statusSettings").addClass("alert-danger").removeClass("hidden").html("There is an error with one or more of your settings");	
		}
	});
	

	// clear results when data changed
	$("#verify #verifyScript").on('input change', function(){
		$("#verify .verifyData").addClass("hidden");
	});

	$("#sign #signTransaction, #sign #signPrivateKey").on('input change', function(){
		$("#sign #signedData").addClass("hidden");
	});

	$("#multisigPubKeys .list").on('input change', '.pubkey', function(){
		$("#multiSigData").addClass("hidden");
	});


	$("#coinSelector").change(function(){
		$("#coinjs_coin").val(this.value).change();
		$("#settingsBtn").click();
	});
	$("#coinjs_coin").change(function(){
		var o = ($("option:selected",this).attr("rel")).split(";");

		var mode = this.options[this.selectedIndex].value;
		
		var walletAvailableUnspent = false;
		var walletAvailableTransaction = false;
		var walletAvailableBroadcast = false;
		
		// deal with listUnspent settings`
		
		$('#coinjs_utxo').empty();
		if(typeof(providers[mode]) == 'object' && typeof(providers[mode].listUnspent) == 'object' && Object.keys(providers[mode].listUnspent).length > 0){
			$.each(providers[mode].listUnspent, function(key) {
				$('#coinjs_utxo').append($('<option>', {
					value: key,
					text: key
				}));
			});
			
			$("#coinjs_utxo, #redeemFrom, #redeemFromBtn").attr('disabled',false);
			$("#coinjs_utxo").val(o[6]);
			
			$("#redeemFrom").val("");
			
			walletAvailableUnspent = true;
		} else {
			$("#coinjs_utxo, #redeemFrom, #redeemFromBtn").attr('disabled',true);
			$("#coinjs_utxo").append('<option value="disabled">Currently not available for ' + this.options[ this.selectedIndex ].text+'</option>').val("disabled");
			
			$("#redeemFrom").val("Loading of address inputs is currently not available for " + this.options[ this.selectedIndex ].text);
		}

		// deal with get transaction

		$('#coinjs_gettransaction').empty();
			   if(typeof(providers[mode]) == 'object' && typeof(providers[mode].getTransaction) == 'object' && Object.keys(providers[mode].getTransaction).length > 0){
					   $.each(providers[mode].getTransaction, function(key) {
							   $('#coinjs_gettransaction').append($('<option>', {
									   value: key,
									   text: key
							   }));
					   });

					   $("#coinjs_gettransaction").attr('disabled',false);
					   $("#coinjs_gettransaciton").val(o[8]);

					   // $("#redeemFr").val("");

					   walletAvailableTransaction = true;
			   } else {
					   $("#coinjs_gettransaction").attr('disabled',true);
					   $("#coinjs_gettransaction").append('<option value="disabled">Currently not available for ' + this.options[ this.selectedIndex ].text+'</option>').val("disabled");

					   // $("#redeemFrom").val("Loading of address inputs is currently not available for " + this.options[ this.selectedIndex ].text);
			   }
		
		// deal with input amount settings
		$('#coinjs_getinputamount').empty();
		if(typeof(providers[mode]) == 'object' && typeof(providers[mode].getInputAmount) == 'object' && Object.keys(providers[mode].getInputAmount).length > 0){
			$.each(providers[mode].getInputAmount, function(key) {
				$('#coinjs_getinputamount').append($('<option>', {
					value: key,
					text: key
				}));
			});
			
			$("#coinjs_getinputamount").attr('disabled',false);
			$("#coinjs_getinputamount").val(o[7]);
		} else {
			$("#coinjs_getinputamount").attr('disabled',true);
			$("#coinjs_getinputamount").append('<option value="disabled">Currently not available for ' + this.options[ this.selectedIndex ].text+'</option>').val("disabled");
		}
		
		// deal with broadcasting settings

		$('#coinjs_broadcast').empty();
		if(typeof(providers[mode]) == 'object' && typeof(providers[mode].broadcast) == 'object' && Object.keys(providers[mode].broadcast).length > 0){
			$.each(providers[mode].broadcast, function(key) {
				$('#coinjs_broadcast').append($('<option>', {
					value: key,
					text: key
				}));
			});
			
			$("#coinjs_broadcast, #rawTransaction, #rawSubmitBtn").attr('disabled',false);
			$("#coinjs_broadcast").val(o[5]);
			
			$("#rawTransaction").val("");
			
			walletAvailableBroadcast = true;
		} else {
			$("#coinjs_broadcast, #rawTransaction, #rawSubmitBtn").attr('disabled',true);
			$("#coinjs_broadcast").append('<option value="disabled">Currently not available for ' + this.options[ this.selectedIndex ].text+'</option>').val("disabled");
			
			$("#rawTransaction").val("Transaction broadcasting is currently not available for " + this.options[ this.selectedIndex ].text);	
		}
		
		// enable wallet if available
		$("#openBtn").attr('disabled', (walletAvailableUnspent && walletAvailableBroadcast));

		// deal with the reset
		$("#coinjs_pub").val(o[0]);
		$("#coinjs_multisig").val(o[1]);
		$("#coinjs_priv").val(o[2]);
		$("#coinjs_hdpub").val(o[3]);
		$("#coinjs_hdprv").val(o[4]);
		
		$("#coinjs_extratimefield").val(o[9]);
		$("#coinjs_extraunitfieldvalue").val(o[10]);
		
		$("#coinjs_decimalplaces").val(o[11]);

		$("#coinjs_symbol").val(o[12]);

		$("#coinjs_bip44").val(o[13]);

		$("#coinjs_ledger").val(o[14]);

		$("#coinjs_bech32").val(o[15]);
		// hide/show custom screen
		if($("option:selected",this).val()=="custom"){
			$("#settingsCustom").removeClass("hidden");
		} else {
			$("#settingsCustom").addClass("hidden");
		}
	});

	/* verify page code*/

	$("#verifyTransactionData .ins tbody").on( "click", "a[data-index-multisig]", function(e) {
		e.preventDefault();
		decodeMultiSig($("#verifyTransactionData .ins tbody").data("tx"), $(this).attr("data-index-multisig"));
	});

	$("#verifyTransactionData .ins tbody").on( "click", "a[data-index-inputscript]", function(e) {
		e.preventDefault();
		decodeScript($("#verifyTransactionData .ins tbody").data("tx").ins[$(this).attr("data-index-inputscript")].script);
	});

	$("#verifyTransactionData .outs tbody").on( "click", "a[data-index-outputscript]", function(e) {
		e.preventDefault();
		decodeScript($("#verifyTransactionData .ins tbody").data("tx").outs[$(this).attr("data-index-outputscript")].script);
	});

	/* capture mouse movement to add entropy */
	var IE = document.all?true:false // Boolean, is browser IE?
	if (!IE) document.captureEvents(Event.MOUSEMOVE)
	document.onmousemove = getMouseXY;
	
	$("html").on( "click", "input[readonly]", function () {
		this.select();
	});
	
	$.each(known.pubKey, function(pubkey, id) {
		$('#mediatorList').append($('<option>', {
			value: pubkey+';'+id.email+';'+id.fee,
			text: id.name
		}));
	});
	$("#mediatorList").change();

	$("#coinjs_coin option").clone().appendTo("#coinSelector");
	
	var _getMode = _get("mode");
	if(_getMode[0]){
		$("#coinSelector").val(_getMode[0]);
	}
	$("#coinSelector").change();

	//$("#newKeysBtn, #newHDKeysBtn").click();
	$("#sighashType").change(function(){
		$("#sighashTypeInfo").html($("option:selected",this).attr('rel')).fadeOut().fadeIn();
	});

	$("#signAdvancedCollapse").click(function(){
		if($("#signAdvanced").hasClass('hidden')){
			$("span",this).removeClass('glyphicon-collapse-down').addClass('glyphicon-collapse-up');
			$("#signAdvanced").removeClass("hidden");
		} else {
			$("span",this).removeClass('glyphicon-collapse-up').addClass('glyphicon-collapse-down');
			$("#signAdvanced").addClass("hidden");
		}
	});

	var _getBroadcast = _get("broadcast");
	if(_getBroadcast[0]){
		$("#rawTransaction").val(_getBroadcast[0]);
		$("#rawSubmitBtn").click();
		window.location.hash = "#broadcast";
	}

	var _getVerify = _get("verify");
	if(_getVerify[0]){
		$("#verifyScript").val(_getVerify[0]);
		$("#verifyBtn").click();
		window.location.hash = "#verify";
	}

	var _getAddress = _get("address");
	if(_getAddress[0]){
		$("#redeemFrom").val(_getAddress[0]);
		$("#redeemFromBtn").click();
		window.location.hash = "#newTransaction";
	}

	$(".qrcodeBtn").click(function(){
		$("#qrcode").html("");
		var thisbtn = $(this).parent().parent();
		var qrstr = false;
		var ta = $("textarea",thisbtn);

		if(ta.length>0){
			var w = (screen.availWidth > screen.availHeight ? screen.availWidth : screen.availHeight)/3.5;
			var qrcode = new QRCode("qrcode", {width:w, height:w});
			qrstr = $(ta).val();
			if(qrstr.length > 1024){
				$("#qrcode").html("<p>Sorry the data is too long for the QR generator.</p>");
			}
		} else {
			var qrcode = new QRCode("qrcode");
			qrstr = $('.address',thisbtn).val();
		}

		if(qrstr){
			qrcode.makeCode(qrstr);
		}
	});

	$('input[title!=""], abbr[title!=""]').tooltip({'placement':'bottom'});

	if (location.hash !== ''){
		$('a[href="' + location.hash + '"]').tab('show');
	}

	$(".showKey").click(function(){
		if ($(this).data('hidden') === false) {
			$("input[type='text']",$(this).parent().parent()).attr('type','password');
			$(this).data('hidden', true);
			$(".showKey").text("Show");
		} else {
			$("input[type='password']",$(this).parent().parent()).attr('type','text');
			$(this).data('hidden', false);
			$(".showKey").text("Hide");
		}
	});

	$("#homeBtn").click(function(e){
		e.preventDefault();
		history.pushState(null, null, '#home');
		$("#header .active, #content .tab-content").removeClass("active");
		$("#home").addClass("active");
	});

	$('a[data-toggle="tab"]').on('click', function(e) {
		e.preventDefault();
		if(e.target && $(e.target).attr('href')){
			history.pushState(null, null, '#'+$(e.target).attr('href').substr(1));
		}
	});

	window.addEventListener("popstate", function(e) {
		var activeTab = $('[href=' + location.hash + ']');
		if (activeTab.length) {
			activeTab.tab('show');
		} else {
			$('.nav-tabs a:first').tab('show');
		}
	});

	for(i=1;i<3;i++){
		$(".pubkeyAdd").click();
	}

	$( ".sort" ).sortable({
		handle: '.handle',
		change: function() {$("#multiSigData").addClass("hidden")}
	});

	validateOutputAmount();
	
	window["cointoolkit"] = toolkit;
});
