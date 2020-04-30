$(document).ready(function () {
    let redOps = $('#red-operations').children('option').length-1;
    let blueOps = $('#blue-operations').children('option').length-1;
    if(redOps===0 && blueOps===0) {
        stream('GameBoard is only useful if a red or blue operation has been started.')
    } else {
        stream('Select red/blue operations to see what the defense detected and responded to.');
    }
});

function refresh(){
    function draw(data){
        let spacing = '&nbsp;&nbsp;-&nbsp;&nbsp;';
        $('#the-gameboard .gameboard-row').not(':first').remove();

        let redOp = data.red_op;
        let blueOp = data.blue_op;

        if (redOp){
            updateOpState('red', redOp.state)
        }
        if (blueOp) {
            updateOpState('blue', blueOp.state)
        }

        updateExchanges(data.exchanges, data.access)

        $(".golden-goose").on('click', function () {
            var $input = $( this );
            var id = $input.attr("id").split("_");
            document.getElementById('piece-modal').style.display='block';
            exchange = findExchange(data.exchanges, id[1])
            let link = exchange[id[2]][id[3]];
            $('#piece-cmd').html(atob(link['command']));
            let factList = $('#piece-fact-list');
            link['facts'].forEach(function(fact) {
                let pieceFact = $('#piece-fact').clone();
                pieceFact.html(fact.trait + ": " + fact.value);
                pieceFact.show();
                factList.append(pieceFact);
            })
        })

        if (data.access == "blue") {
            $(".gp-red").on('click', function () {
                if ($(this).css( "transform" ) == 'none'){
                    $(this).css("transform","rotateY(180deg)");
                    $(this).closest(".gp-wrapper").find(".gp-cover").css("transform", "")
                } else {
                    $(this).css("transform","");
                    $(this).closest(".gp-wrapper").find(".gp-cover").css("transform", "rotateY(180deg)")
                }
            })
        }
        if (data.access == "red") {
            $(".gp-blue").on('click', function () {
                if ($(this).css( "transform" ) == 'none'){
                    $(this).css("transform","rotateY(180deg)");
                    $(this).closest(".gp-wrapper").find(".gp-cover").css("transform", "")
                } else {
                    $(this).css("transform","");
                    $(this).closest(".gp-wrapper").find(".gp-cover").css("transform", "rotateY(180deg)")
                }
            })
        }
        $(".gp-cover").on('click', function () {
            if ($(this).css( "transform" ) == 'none'){
                $(this).css("transform","rotateY(180deg)");
                $(this).closest(".gp-wrapper").find(".gp-red").css("transform", "")
                $(this).closest(".gp-wrapper").find(".gp-blue").css("transform", "")
            } else {
                $(this).css("transform","");
                $(this).closest(".gp-wrapper").find(".gp-red").css("transform", "rotateY(180deg)")
                $(this).closest(".gp-wrapper").find(".gp-blue").css("transform", "rotateY(180deg)")
            }
        })

    }
    let redOpId = parseInt($('#red-operations option:selected').attr('value'));
    let blueOpId = parseInt($('#blue-operations option:selected').attr('value'));
    stream('Gold stars mean information was learned to help the team.');
    restRequest('POST', {'red':redOpId,'blue':blueOpId}, draw, '/plugin/gameboard/pieces');
}

function handOutBluePoints(link) {
    let points = 0;
    if(link.facts.length == 0) {
        points -= 1;
        return points
    }
    if(link.ability.tactic === 'response') {
        points += 2;
    }
    return points;
}

function handOutRedPoints(link){
    let points = 0;
    if(link.status !== 0) {
        points -= 1;
        return points;
    }
    if(link.ability.tactic === 'credential-access') {
        points += 3;
    } else if(link.ability.tactic === 'collection') {
        points += 2;
    } else if (link.ability.tactic === 'impact') {
        points +=3;
    } else if (link.ability.tactic === 'lateral-movement') {
        points +=5;
    } else if (link.ability.tactic === 'exfiltration') {
        points +=3;
    } else if (link.ability.tactic === 'defense-evasion') {
        points +=4;
    } else if (link.ability.tactic === 'persistence') {
        points +=6;
    } else if (link.ability.tactic === 'privilege-escalation') {
        points +=3;
    } else {
        points += 1;
    }
    return points;
}

function resetPieceModal() {
    let modal = $('#piece-modal');
    modal.hide();
    modal.find('#piece-cmd').html('');
    modal.find('#piece-fact-list').html('<pre id="piece-fact" style="display: none"></pre>');
    modal.find('#piece-queries').html('<pre id="piece-query" style="display: none"></pre>');
}

function updateOpState(op, state) {
    let status = $('#' + op + '-status');
    if (state == "running") {
        status.css("background-color", "darkgoldenrod")
    }
    if (state == "finished") {
        status.css("background-color", "green")
    }
    status.html(state).show();
}

function addGamePieces(op, piece, links, pid, hide) {
    for (let i=0; i<links.length;i++) {
        let col = piece.find('.' + op);
        let wrapper = $('#' + op + '-wrapper').clone();
        wrapper.attr('id', 'wrapper-' + pid + '-' + op + '-' + i);
        let gamePiece = $('#' + op + '-piece').clone();
        let coverPiece = $('#cover-piece').clone();
        coverPiece.attr('id', 'cover-' + pid + '-' + op + '-' + i);
        coverPiece.css("transform","rotateY(180deg)");
        gamePiece.html(
            '<span id="result_' + pid + '_' + op + '_' + i + '" class="golden-goose"><span></span></span>' +
            '<span class="gp-ability">' + links[i].ability.name + '</span>' +
            '<span class="gp-time">' + links[i].finish + '</span>' +
            '<span class="gp-agent">' + links[i].paw + '</span>');
        gamePiece.css("display", "flex");
        coverPiece.css("display", "flex")
        wrapper.append(coverPiece)
        wrapper.append(gamePiece)
        wrapper.show()
        if (links[i].facts.length > 0) {
            gamePiece.find('.golden-goose span').html('&#11088;');
        }
        col.append(wrapper);
        if (hide) {
            hidePieces(gamePiece, coverPiece)
        }
    }
    if (links.length > 0) {
        piece.find('.mid').html(
            '<span class="gp-pid">'+ pid +'</span>' +
            '<span class="gp-host">'+ links[0].host +'</span>');
    }
}

function updateExchanges(exchanges, access) {
    let redPoints = 0;
    let bluePoints = 0;
    let pid = 0;

    for(let i = 0; i < exchanges.length; i++){
        pid = exchanges[i][0]
        exchange = exchanges[i][1]

        for (let i=0; i<exchange['red'].length; i++){
            redPoints += handOutRedPoints(exchange['red'][i]);
        }
        for (let i=0; i<exchange['blue'].length; i++){
            bluePoints += handOutBluePoints(exchange['blue'][i]);
        }

        let piece = $("#game-piece").clone();
        piece.attr("id", "pid_id_" + pid);

        if (access == "blue") {
            addGamePieces('red', piece, exchange['red'], pid, true);
            addGamePieces('blue', piece, exchange['blue'], pid, false);
        }
        else {
            addGamePieces('red', piece, exchange['red'], pid, false);
            addGamePieces('blue', piece, exchange['blue'], pid, true);
        }

        $('#exchanges').append(piece);
        piece.show();
    }

    $('#gb-blue-points').text(bluePoints);
    $('#gb-red-points').text(redPoints);
}

function hidePieces(gamePiece, coverPiece) {
    gamePiece.css("transform", "rotateY(180deg)");
    coverPiece.css("transform", "");
}

function findExchange(exchanges, pid) {
    for (let i = 0; i < exchanges.length; i++) {
        if (exchanges[i][0] == pid) {
            return exchanges[i][1]
        }
    }
}
