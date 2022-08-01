/*
AUTHOR: Evan Ward
BLUF: A micro web app to make generating, refining, and sharing random variables as easy as possible.
Github: https://github.com/EvanWard97/Probability.dev
Contact: https://evanward.org/contact
More info: http://probability.dev/readme.md
*/
function main() {
    const WEIGHT = 1
    let IS_MOUSE_DOWN = false
    let PREVIOUS_XCLICK
    let PREVIOUS_YCLICK
    let UPDATING_PLOT
    let TITLE
    let DESCRIPTION
    let XUNITS
    let AUTHOR
    let CONTACT_INFO
    let DISTRO_EV
    let DISTRO_SD
    let DATE0

    const canvas = document.querySelector('#canvasID')
    const CTX = canvas.getContext('2d')
    let RECT = canvas.getBoundingClientRect()
    const X_LIM = canvas.width
    const Y_LIM = canvas.height
    const X0_SPACE_FACTOR = 15
    const X0 = Math.round(X_LIM / X0_SPACE_FACTOR)
    const X0B = X0 - 1
    const X1 = X_LIM - X0
    const X1B = X1 - 1

    const ZERO_RATIO = 0.9
    const ZERO_LINE = Math.round(Y_LIM * ZERO_RATIO)
    const MAX_PROB = Math.round(Y_LIM * (1 - ZERO_RATIO))
    const PADDING10 = 10
    const PADDING4 = 4
    let X_LABEL_FONT = '20 Roboto'
    const PRECISION = X_LIM - 2 * X0
    const PRECISIONB = PRECISION - 1
    let XYDISTRO

    const XYDISTRO_STACK = []
    const MAX_STACK_HEIGHT = 100
    let MOUSE_COUNT // counts each mouse move over canvas for periodically adding distro to stack

    let CANV_COMMANDS_ENABLED = false
    let EXTENDS = 0

    initialXYDISTRO()

    function initialXYDISTRO() {
        const left = parseFloat(document.querySelector('#leftVal').value)
        const right = parseFloat(document.querySelector('#rightVal').value)
        const confidence = parseFloat(
            document.querySelector('input[name="confidenceRadio"]:checked').value
        )
        const noZero = document.querySelector('#noZero').checked
        let distro

        distro = noZero
            ? distroButNotBelowZero(left, right, confidence, PRECISION, WEIGHT)
            : genNormDistroFromCI(left, right, confidence, PRECISION, WEIGHT)

        XYDISTRO = distroToXY(distro)
        stack(true)
        getXLabelFont()
        getLabels()
        updateGraphStats(XYDISTRO)
        plotXYDISTRO(XYDISTRO, CTX)
    }

    function getXLabelFont() {
        const last = XYDISTRO[PRECISION - 1][3]
        last > 99_999_999
            ? (X_LABEL_FONT = '14px Roboto')
            : last > 9_999_999
            ? (X_LABEL_FONT = '16px Roboto')
            : last > 999_999
            ? (X_LABEL_FONT = '18px Roboto')
            : (X_LABEL_FONT = '20px Roboto')
    }

    function getLabels() {
        TITLE = document.querySelector('#title').value || 'Estimate'
        DESCRIPTION = document.querySelector('#description').value || '.'
        XUNITS = document.querySelector('#xUnits').value || 'X'
        AUTHOR = document.querySelector('#author').value || '.'
        CONTACT_INFO = document.querySelector('#contactInfo').value || 'probability.dev'
        DATE0 = new Date().toDateString()
    }

    document.querySelector('#addGraphLabels').addEventListener('click', () => {
        getLabels()
        plotXYDISTRO(XYDISTRO, CTX)
        document.querySelector('#labelsAdded').innerHTML = 'Labels added.'
    })

    // generate normal distribution from confidence interval
    function genNormDistroFromCI(leftVal, rightVal, confidenceLevel, PRECISION, weight) {
        function confidenceToZscore(c = 0.95) {
            switch (c) {
                case 0.8:
                    return 0.845
                case 0.9:
                    return 1.645
                case 0.95:
                    return 1.96
                case 0.98:
                    return 2.33
                case 0.99:
                    return 2.575
                case 1:
                    return 3
                default:
                    return 1.96
            }
        }
        function stanNormCDF(length, zScore) {
            const probabilities = []
            const e = Math.E
            const aConst = (zScore * 2) / length
            let x
            let prob
            let temp = 0
            for (let i = 0; i < length; i++) {
                x = i * aConst - zScore
                prob = 1 / (1 + e ** (0.0054 - 1.6101 * x - 0.0674 * x ** 3)) // approximation from http://web2.uwindsor.ca/math/hlynka/zogheibhlynka.pdf
                probabilities.push(prob - temp)
                temp = prob
            }
            probabilities[0] = 0
            return probabilities
        }

        const zScore = 3
        const standardDeviation = ((rightVal - leftVal) * 0.5) / confidenceToZscore(confidenceLevel)
        const leftMostX = (leftVal + rightVal) * 0.5 - zScore * standardDeviation
        const xConversionFactor = (2 * zScore * standardDeviation) / PRECISION
        const probs = stanNormCDF(PRECISION, zScore)
        return probs.map((p, i) => {
            return [leftMostX + i * xConversionFactor, p, weight]
        })
    }

    function distroToXY(distro) {
        const maxProb = distro.reduce((highest, x) => {
            return highest > x[1] ? highest : x[1]
        }, 0)
        const leftMostX = distro[0][0]
        const xConversionFactor = PRECISION / (distro[PRECISION - 1][0] - leftMostX)
        const yConversionFactor = Y_LIM / (2 * maxProb)
        return distro.map((x, i) => {
            return [
                Math.round(xConversionFactor * (x[0] - leftMostX) - 1),
                Math.round(ZERO_LINE - yConversionFactor * x[1]),
                x[2],
                x[0],
            ]
        })
    }

    function XYDISTROToDistro(XYDISTRO) {
        let totalProb = 0
        for (const x of XYDISTRO) {
            totalProb += ZERO_LINE - x[1]
        } // computes total probability (area under the curve)
        return XYDISTRO.map((x, i) => {
            return [x[3], (ZERO_LINE - x[1]) / totalProb, x[2]]
        })
    }

    function clickUpdate(xClick, yClick, XYDISTRO, PREVIOUS_XCLICK, PREVIOUS_YCLICK) {
        xClick -= X0
        PREVIOUS_XCLICK -= X0
        const avgYShift = (yClick - PREVIOUS_YCLICK) / (xClick - PREVIOUS_XCLICK)
        let j = 1
        if (xClick > PREVIOUS_XCLICK) {
            for (let i = PREVIOUS_XCLICK; i < xClick; i++) {
                XYDISTRO[i][1] = PREVIOUS_YCLICK + j * avgYShift
                j++
            }
        } else {
            for (let i = PREVIOUS_XCLICK; i > xClick; i--) {
                XYDISTRO[i][1] = PREVIOUS_YCLICK - j * avgYShift
                j++
            }
        }
    }

    function plotXYDISTRO(XYDISTRO, CTX) {
        CTX.fillStyle = '#FFF'
        CTX.fillRect(0, 0, X_LIM, Y_LIM) // clears pixels w/ new white sheet.
        CTX.fillStyle = '#000'

        const j = 5 // number of equaprobability shaded percentiles
        for (let i = 1; i < j + 1; i++) {
            CTX.beginPath()
            const temp = percentiles(i, j)
            const startIndex = temp[0]
            const endIndex = temp[1]
            CTX.strokeStyle = i % 2 === 1 ? '#DDD' : '#EEE'
            for (let i = startIndex; i < endIndex; i++) {
                CTX.moveTo(X0 + XYDISTRO[i][0], ZERO_LINE)
                CTX.lineTo(X0 + XYDISTRO[i][0], XYDISTRO[i][1])
            }
            CTX.moveTo(X0 + XYDISTRO[endIndex][0], ZERO_LINE)
            CTX.lineTo(X0 + XYDISTRO[endIndex][0], XYDISTRO[endIndex][1])
            CTX.stroke()
        }

        CTX.beginPath() // draws lines parallel to x axis + factors to help w/ precise drawing.
        CTX.strokeStyle = '#CCC'
        CTX.lineWidth = 2
        CTX.moveTo(X0, ZERO_LINE)
        CTX.lineTo(X1, ZERO_LINE)
        CTX.font = '18px Roboto'
        CTX.textAlign = 'left'
        CTX.fillText('0', X0B + PADDING4, Y_LIM * (ZERO_RATIO - 0.01))
        CTX.moveTo(X0B, Y_LIM * (ZERO_RATIO - 0.1))
        CTX.lineTo(X1, Y_LIM * (ZERO_RATIO - 0.1))
        CTX.fillText('1x', X0B + PADDING4, Y_LIM * (ZERO_RATIO - 0.11))
        CTX.moveTo(X0B, Y_LIM * (ZERO_RATIO - 0.2))
        CTX.lineTo(X1, Y_LIM * (ZERO_RATIO - 0.2))
        CTX.fillText('2x', X0B + PADDING4, Y_LIM * (ZERO_RATIO - 0.21))
        CTX.moveTo(X0B, Y_LIM * (ZERO_RATIO - 0.3))
        CTX.lineTo(X1, Y_LIM * (ZERO_RATIO - 0.3))
        CTX.fillText('3x', X0B + PADDING4, Y_LIM * (ZERO_RATIO - 0.31))
        CTX.moveTo(X0B, Y_LIM * (ZERO_RATIO - 0.4))
        CTX.lineTo(X1, Y_LIM * (ZERO_RATIO - 0.4))
        CTX.fillText('4x', X0B + PADDING4, Y_LIM * (ZERO_RATIO - 0.41))
        CTX.moveTo(X0B, Y_LIM * (ZERO_RATIO - 0.5))
        CTX.lineTo(X1, Y_LIM * (ZERO_RATIO - 0.5))
        CTX.fillText('5x', X0B + PADDING4, Y_LIM * (ZERO_RATIO - 0.51))
        CTX.moveTo(X0B, Y_LIM * (ZERO_RATIO - 0.6))
        CTX.lineTo(X1, Y_LIM * (ZERO_RATIO - 0.6))
        CTX.fillText('6x', X0B + PADDING4, Y_LIM * (ZERO_RATIO - 0.61))
        CTX.moveTo(X0B, Y_LIM * (ZERO_RATIO - 0.7))
        CTX.lineTo(X1, Y_LIM * (ZERO_RATIO - 0.7))
        CTX.fillText('7x', X0B + PADDING4, Y_LIM * (ZERO_RATIO - 0.71))
        CTX.stroke()

        CTX.beginPath() // draws blue  distribution
        CTX.strokeStyle = '#5680cc'
        CTX.lineWidth = 2.5
        CTX.moveTo(X0 + XYDISTRO[0][0], XYDISTRO[0][1])
        for (let i = 0; i < PRECISION; i++) {
            CTX.lineTo(X0 + XYDISTRO[i][0], XYDISTRO[i][1])
        }
        CTX.stroke()

        // dashed mu line
        const xEV = Math.floor(
            XYDISTRO.reduce((total, x) => {
                return total + x[0] * (ZERO_LINE - x[1])
            }, 0) /
                XYDISTRO.reduce((total, x) => {
                    return total + (ZERO_LINE - x[1])
                }, 0)
        )
        CTX.beginPath()
        CTX.strokeStyle = '#5680cc'
        CTX.setLineDash([5, 10])
        CTX.moveTo(X0 + xEV, XYDISTRO[xEV][1])
        CTX.lineTo(X0 + xEV, ZERO_LINE)
        CTX.stroke()
        CTX.setLineDash([])

        CTX.beginPath() // draws XUNITS, y units (Pr()), xVals along x-axis, TITLE, DESCRIPTION
        CTX.strokeStyle = '#000'
        CTX.textAlign = 'left'
        CTX.font = '24px Roboto'
        CTX.fillText(DISTRO_SD, PADDING10, Y_LIM * 0.035)
        CTX.fillText(DISTRO_EV, PADDING10, Y_LIM * 0.07)

        CTX.font = '21px Roboto'
        CTX.textAlign = 'right'
        CTX.fillText(CONTACT_INFO, X_LIM - PADDING10, Y_LIM * 0.035)
        CTX.fillText(AUTHOR, X_LIM - PADDING10, Y_LIM * 0.075)
        CTX.fillText(DATE0, X_LIM - PADDING10, Y_LIM - PADDING10)

        CTX.font = '30px Roboto'
        CTX.strokeText('Pr', X0 - 1.5 * PADDING10, Y_LIM * 0.46)

        CTX.textAlign = 'center'
        CTX.strokeText(TITLE, X_LIM * 0.5, Y_LIM * 0.05)
        CTX.strokeText(XUNITS, X_LIM * 0.5, Y_LIM * 0.985)
        CTX.font = '14px Roboto'
        CTX.fillText(DESCRIPTION, X_LIM * 0.5, Y_LIM * 0.09)

        CTX.font = '16px Roboto'
        CTX.fillText('μ', X0 + xEV, XYDISTRO[xEV][1] - 6)

        CTX.font = X_LABEL_FONT
        CTX.lineWidth = 2
        for (let i = 0; i < 13; i++) {
            let x = Math.round((PRECISION * i) / (X0_SPACE_FACTOR - 3))
            if (x > PRECISIONB) {
                x = PRECISIONB
            }
            CTX.fillText(format(XYDISTRO[x][3]), X0 + x, Y_LIM * (ZERO_RATIO + 0.036))
            if (x === 0) {
                x = -2
            }
            if (x === PRECISIONB) {
                x += 2
            }
            CTX.moveTo(X0 + x, Y_LIM * (ZERO_RATIO + 0.01))
            CTX.lineTo(X0 + x, Y_LIM * (ZERO_RATIO - 0.01))
        }
        CTX.lineWidth = 2
        CTX.strokeStyle = '#000'
        CTX.moveTo(X1, ZERO_LINE)
        CTX.lineTo(X0 - 2, ZERO_LINE)
        CTX.lineTo(X0 - 2, Y_LIM * 0.1 - 1)
        CTX.lineTo(X1 + 1, Y_LIM * 0.1 - 1)
        CTX.lineTo(X1 + 1, ZERO_LINE)
        CTX.stroke()
    }

    function displayHoverVal(e) {
        const xClick = Math.round(e.clientX - RECT.left) - X0
        const yClick = e.clientY - RECT.top
        if (xClick > 0 && xClick < PRECISION && yClick < ZERO_LINE) {
            const ev = expectedValueFromXY(XYDISTRO)
            const sd = standardDeviationXY(XYDISTRO)
            DISTRO_EV = `μ: ${numberWithCommas(Math.round((ev + Number.EPSILON) * 100) / 100)}`
            DISTRO_SD = `σ: ${numberWithCommas(Math.round((sd + Number.EPSILON) * 100) / 100)}`
            const x = format(XYDISTRO[xClick][3])
            const totalP = XYDISTRO.reduce((total, x) => {
                return total + (ZERO_LINE - x[1])
            }, 0)
            const leftP = XYDISTRO.slice(0, xClick).reduce((total, x) => {
                return total + (ZERO_LINE - x[1])
            }, 0)
            const percentile = format((leftP / totalP) * 100)
            CTX.beginPath()
            CTX.fillStyle = '#FFF'
            CTX.fillRect(X0, Y_LIM - 40, X0 + 260, Y_LIM) // clears old stuff w/ new small white sheet.
            CTX.fillStyle = '#000'
            CTX.font = '20px Roboto'
            CTX.textAlign = 'left'
            CTX.fillText(`z: ${format((XYDISTRO[xClick][3] - ev) / sd)}`, X0, Y_LIM * 0.98)
            /* ZDIST = ZDIST > CTX.measureText(x).width ? ZDIST : CTX.measureText(x).width */
            CTX.fillText(`p: ${percentile}%`, X0 + 70, Y_LIM * 0.98)
            CTX.fillText(`x: ${x}`, X0 + 160, Y_LIM * 0.98)
            CTX.stroke()
        }
    }

    function percentiles(i, j) {
        const interval =
            XYDISTRO.reduce((total, x) => {
                return total + (ZERO_LINE - x[1])
            }, 0) / j
        const negInterval = interval * -1 + 20
        let startIndex = 0
        let firstVisit = true
        let firstVisit2 = true
        let probRemaining = (i - 1) * interval
        let out
        for (const [i, x] of XYDISTRO.entries()) {
            probRemaining -= ZERO_LINE - x[1] // probability mass in column
            if (probRemaining <= 0) {
                if (firstVisit) {
                    startIndex = i
                    firstVisit = false
                }
                if (probRemaining <= negInterval) {
                    if (firstVisit2) {
                        out = [startIndex, i]
                        firstVisit2 = false
                    }
                }
            }
        }
        return out
    }

    function expectedValueFromXY(XYDISTRO) {
        const totalProb = XYDISTRO.reduce((total, x) => {
            return total + (ZERO_LINE - x[1])
        }, 0)
        const evIndex = Math.floor(
            XYDISTRO.reduce((total, x) => {
                return total + x[0] * (ZERO_LINE - x[1])
            }, 0) / totalProb
        )
        return XYDISTRO[evIndex][3]
    }

    function standardDeviationXY(XYDISTRO) {
        const totalProb = XYDISTRO.reduce((total, x) => {
            return total + (ZERO_LINE - x[1])
        }, 0)
        const evIndex = Math.floor(
            XYDISTRO.reduce((total, x) => {
                return total + x[0] * (ZERO_LINE - x[1])
            }, 0) / totalProb
        )
        let sum = 0
        let pMass = 0
        let sqrdError = 0
        for (const [i, x] of XYDISTRO.entries()) {
            pMass = ZERO_LINE - x[1]
            sqrdError = (evIndex - i) * (evIndex - i)
            for (let i = 0; i < pMass; i++) {
                sum += sqrdError
            }
        }
        sum /= totalProb
        const stanDev = Math.sqrt(sum) // sd in canvas coords
        return (stanDev * (XYDISTRO[PRECISION - 1][3] - XYDISTRO[0][3])) / PRECISION // convert to regular x
    }

    function updateGraphStats(XYDISTRO) {
        const ev = expectedValueFromXY(XYDISTRO)
        DISTRO_EV = `μ: ${numberWithCommas(Math.round((ev + Number.EPSILON) * 100) / 100)}`
        const sd = standardDeviationXY(XYDISTRO)
        DISTRO_SD = `σ: ${numberWithCommas(Math.round((sd + Number.EPSILON) * 100) / 100)}`
    }

    document.querySelector('#genVarBtn').addEventListener('click', () => {
        initialXYDISTRO()
        updateGraphStats(XYDISTRO)
        plotXYDISTRO(XYDISTRO, CTX)
        document.querySelector('#variable generated').innerHTML = 'Variable generated.'
    })

    canvas.addEventListener('mousedown', (e) => {
        // to add touch support for touch screens // basically copy, but with ~'touchdown'
        RECT = canvas.getBoundingClientRect() // gets new coords of canvas considering user could scroll page
        displayHoverVal(e)
        if (e.clientX - RECT.left > X0 && e.clientX - RECT.left < X0 + PRECISION) {
            PREVIOUS_XCLICK = Math.round(e.clientX - RECT.left)
            CANV_COMMANDS_ENABLED = true
        } else {
            PREVIOUS_XCLICK = null
            CANV_COMMANDS_ENABLED = false
        }
        if (e.clientY - RECT.top < ZERO_LINE && e.clientY - RECT.top > MAX_PROB) {
            PREVIOUS_YCLICK = e.clientY - RECT.top
        } else {
            PREVIOUS_YCLICK = null
            CANV_COMMANDS_ENABLED = false
        }
        IS_MOUSE_DOWN = true

        UPDATING_PLOT = window.setInterval(() => {
            plotXYDISTRO(XYDISTRO, CTX) // updates canvas every 40ms
        }, 40)
    })

    canvas.addEventListener('mousemove', (e) => {
        displayHoverVal(e)
        if (IS_MOUSE_DOWN === true) {
            let xClick = Math.round(e.clientX - RECT.left)
            let yClick = e.clientY - RECT.top
            if (PREVIOUS_XCLICK === null) {
                PREVIOUS_XCLICK = xClick
            }
            if (PREVIOUS_YCLICK === null) {
                PREVIOUS_YCLICK = yClick
            }
            if (xClick < X0) {
                xClick = X0
            }
            if (xClick > X1B) {
                xClick = X1B
            }
            if (yClick > ZERO_LINE) {
                yClick = ZERO_LINE
            }
            if (yClick < MAX_PROB) {
                yClick = MAX_PROB
            }
            clickUpdate(xClick, yClick, XYDISTRO, PREVIOUS_XCLICK, PREVIOUS_YCLICK)
            PREVIOUS_XCLICK = xClick
            PREVIOUS_YCLICK = yClick

            MOUSE_COUNT++
            if (MOUSE_COUNT >= 100) {
                MOUSE_COUNT = 0
                stack(true)
            }
        }
    })

    window.addEventListener('mouseup', (e) => {
        if (IS_MOUSE_DOWN === true) {
            IS_MOUSE_DOWN = false
            window.clearInterval(UPDATING_PLOT)
            updateGraphStats(XYDISTRO)
            plotXYDISTRO(XYDISTRO, CTX)
            displayHoverVal(e)
            RECT = canvas.getBoundingClientRect()

            MOUSE_COUNT = 0
            stack(true)
        }
    })

    // locks scrolling from touches on the canvas on mobile
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault()
    })
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault()
    })
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault()
    })
    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault()
    })

    // Set up touch events for mobile
    // works by converting touches to clicks
    canvas.addEventListener(
        'touchstart',
        (e) => {
            CANV_COMMANDS_ENABLED = true
            const touch = e.touches[0]
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
            })
            canvas.dispatchEvent(mouseEvent)
        },
        false
    )

    canvas.addEventListener(
        'touchend',
        (e) => {
            const mouseEvent = new MouseEvent('mouseup', {})
            canvas.dispatchEvent(mouseEvent)
        },
        false
    )

    canvas.addEventListener(
        'touchmove',
        (e) => {
            const touch = e.touches[0]
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY,
            })
            canvas.dispatchEvent(mouseEvent)
        },
        false
    )

    /*
    Need to implement heatmap with two keys. This extra dimension can represent the WEIGHT of probabilities.
    Some propabilities are low, but one does not expec tthem to change.  For others, one does expect them to change.

    */
    function XYDISTROToXVals(XYDISTRO, nVals, round) {
        const avg =
            XYDISTRO.reduce((total, x) => {
                return total + (ZERO_LINE - x[1])
            }, 0) / nVals
        const xVals = []
        let prob = 0
        for (const [i, x] of XYDISTRO.entries()) {
            prob += ZERO_LINE - x[1] // probability mass in column
            while (prob >= 0) {
                prob -= avg
                xVals.push(x[3])
            }
        }
        let rounder = 1
        for (let i = 0; i < round; i++) {
            rounder *= 10
        }
        return removeRepeatXVals(xVals, rounder)
        // return xVals
    }

    // creates a greater spread of xVals.
    // Possibly not desirable for certain precise statistical applications where XVals are precise and not subjective.
    // this function isn't truly necessary, but it looks nice to not have a bunch of repeated values.
    function removeRepeatXVals(xVals, rounder) {
        let lastLowerIdx = 0
        let numRepeats = 0
        let equaDist
        let j
        let startIndex
        let nextVal
        let half
        const lim = xVals.length
        for (let i = 0; i < lim; i++) {
            if (xVals[i - 1] === xVals[i]) {
                // if last num equals this one
                numRepeats++
            } else {
                half = Math.round(numRepeats / 2 - 0.5)
                equaDist = Math.round(
                    Math.max(xVals[i] - xVals[i - 1], xVals[i - 1] - xVals[lastLowerIdx]) / half
                )
                startIndex = i + half - numRepeats
                if (numRepeats % 2 === 0) {
                    nextVal = xVals[i]
                }
                for (j = 1; j < half + 1; j++) {
                    xVals[startIndex + j] += j * equaDist
                    xVals[startIndex - j] -= j * equaDist
                }
                if (numRepeats % 2 === 0) {
                    xVals[i] = nextVal
                } // resolves problem from evens
                numRepeats = 1
                lastLowerIdx = i - 1
            }
        }
        for (let i = 0; i < lim; i++) {
            xVals[i] = Math.round((xVals[i] + Number.EPSILON) * rounder) / rounder
        }
        return xVals.sort((a, b) => {
            return a - b
        })
    }

    function displayXValStats(xVals) {
        let xValEV =
            xVals.reduce((sum, x) => {
                return sum + x
            }, 0) / xVals.length
        let xValSD = Math.sqrt(
            xVals.reduce((sd, x) => {
                return sd + (x - xValEV) * (x - xValEV)
            }) / xVals.length
        )
        xValSD = Math.round((xValSD + Number.EPSILON) * 100) / 100
        xValEV = Math.round((xValEV + Number.EPSILON) * 100) / 100
        document.querySelector('#ExportsEV').innerHTML = `Expected value: ${format(xValEV)}`
        document.querySelector('#ExportsSD').innerHTML = `Standard deviation: ${format(xValSD)}`
    }

    document.querySelector('#export').addEventListener('click', (e) => {
        const nVals = parseInt(document.querySelector('input[name="n"]').value)
        const round = parseInt(document.querySelector('input[name="rounder"]').value)
        const xVals = XYDISTROToXVals(XYDISTRO, nVals, round)
        displayXValStats(xVals)
        // xVals = xVals.map(x => numberWithCommas(atLeast3SigFigs(x)))
        const temp = xVals.join(', ')
        document.querySelector('#valuesToPaste').innerHTML = temp
    })

    document.querySelector('#csvSave').addEventListener('click', () => {
        const n = parseInt(document.querySelector('input[name="n"]').value)
        const distro = XYDISTROToDistro(XYDISTRO)
        const round = parseInt(document.querySelector('input[name="rounder"]').value)
        const xVals = XYDISTROToXVals(XYDISTRO, n, round)
        displayXValStats(xVals)
        const csvContent =
            `data:text/csv;charset=utf-8,${n} xVals:,${xVals.join(', ')}\n` +
            `xVal,probability,WEIGHT \n${distro.map((e) => e.join(',')).join('\n')}`
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        // const title = TITLE.splice(0,20)+"ranVar.csv" // add regex to remove data that can't be a part of links
        link.setAttribute('download', 'randomVariable.csv')
        document.body.append(link)
        link.click()
        link.remove()
        document.querySelector('#exportStatus').innerHTML = 'CSV downloaded.'
    })

    document.querySelector('#copyValues').addEventListener('click', (e) => {
        const copyText = document.querySelector('#valuesToPaste')
        copyText.select()
        copyText.setSelectionRange(0, 99_999)
        document.execCommand('copy')
        document.querySelector('#exportStatus').innerHTML = 'Values copied.'
    })

    document.querySelector('#pngSave').addEventListener('click', (e) => {
        CTX.beginPath()
        CTX.fillStyle = '#FFF'
        CTX.fillRect(X0, Y_LIM - 40, X0 + 260, Y_LIM)
        CTX.fillStyle = '#000'
        CTX.stroke() /* removes x and z values that are only a function of last mouse position on canvas */
        const link = document.createElement('a')
        link.innerHTML = 'download image'
        link.href = canvas.toDataURL('image/png', 1).replace('image/png', 'image/octet-stream')
        // const title = TITLE.splice(0,20)+"ranVar.png" // add regex to remove data that can't be a part of links
        link.download = 'randomVariable.png'
        document.body.append(link)
        link.click()
        link.remove()
        document.querySelector('#exportStatus').innerHTML = 'PNG of canvas saved.'
    })

    function format(number) {
        return numberWithCommas(atLeast3SigFigs(number))
    }

    function numberWithCommas(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }

    function atLeast3SigFigs(number) {
        const nstring = number.toString()
        for (let i = 0; i < nstring.length; i++) {
            if (nstring[i] === '.') {
                if (i > 3) {
                    return Math.round(number)
                }
                if (i === 2) {
                    return Math.round((number + Number.EPSILON) * 10) / 10
                }
                if (i === 1) {
                    return Math.round((number + Number.EPSILON) * 100) / 100
                }
                if (i === 0) {
                    return Math.round((number + Number.EPSILON) * 1000) / 1000
                }
            }
        }
        return Math.round(number)
    }

    document.addEventListener('keydown', (e) => {
        if (!CANV_COMMANDS_ENABLED) {
            return
        }
        let lim
        let i
        const adjustmentPrecision = 10
        switch (e.key) {
            case 'w':
                XYDISTRO = XYDISTRO.map((x) => {
                    return [
                        x[0],
                        x[1] - adjustmentPrecision > MAX_PROB
                            ? x[1] - adjustmentPrecision
                            : MAX_PROB,
                        x[2],
                        x[3],
                    ]
                })
                stack(true)
                break
            case 's':
                XYDISTRO = XYDISTRO.map((x) => {
                    return [
                        x[0],
                        x[1] + adjustmentPrecision < ZERO_LINE
                            ? x[1] + adjustmentPrecision
                            : ZERO_LINE,
                        x[2],
                        x[3],
                    ]
                })
                stack(true)
                break
            case 'a':
                lim = PRECISION - 1 - adjustmentPrecision
                XYDISTRO = XYDISTRO.map((x, i) => {
                    return [
                        x[0],
                        i < lim ? XYDISTRO[i + adjustmentPrecision][1] : ZERO_LINE,
                        i < lim ? XYDISTRO[i + adjustmentPrecision][2] : 1,
                        x[3],
                    ]
                })
                stack(true)
                break
            case 'd':
                for (i = PRECISION - 1; i > 0; i--) {
                    XYDISTRO[i][1] =
                        i > adjustmentPrecision ? XYDISTRO[i - adjustmentPrecision][1] : ZERO_LINE
                    XYDISTRO[i][2] =
                        i > adjustmentPrecision ? XYDISTRO[i - adjustmentPrecision][2] : ZERO_LINE
                }
                stack(true)
                break
            case 'z':
                stack(false)
                break
            /* case 'e':
        extendRight()
        break
      case 'q':
        extendLeft()
        break */
        }
        updateGraphStats(XYDISTRO)
        plotXYDISTRO(XYDISTRO, CTX)
    })

    function stack(addOrUndo) {
        console.log(addOrUndo)
        if (addOrUndo) {
            // add = true
            XYDISTRO_STACK.push(JSON.parse(JSON.stringify(XYDISTRO)))
            if (XYDISTRO_STACK.length > MAX_STACK_HEIGHT) {
                XYDISTRO_STACK.shift()
            }
        } else if (XYDISTRO_STACK.length > 1) {
            XYDISTRO = XYDISTRO_STACK[XYDISTRO_STACK.length - 2]
            XYDISTRO_STACK.pop()
        }
        plotXYDISTRO(XYDISTRO, CTX)
    }

    function extendRight() {
        EXTENDS++
        if (EXTENDS >= 0) {
            const length = XYDISTRO.length
            const avgXGap = (XYDISTRO[length - 1][3] - XYDISTRO[0][3]) / length
            XYDISTRO = XYDISTRO.map((x, i) => {
                return [x[0], x[1], x[2], x[3] + avgXGap * i]
            })
        } else {
            const length = XYDISTRO.length
            const avgXGap = ((XYDISTRO[length - 1][3] - XYDISTRO[0][3]) * 0.5) / length
            XYDISTRO = XYDISTRO.map((x, i) => {
                return [x[0], x[1], x[2], x[3] - avgXGap * i] //* last working here
            })
        }
    }
    function extendLeft() {
        const length = XYDISTRO.length
        const avgXGap = (XYDISTRO[length - 1][3] - XYDISTRO[0][3]) / length
        XYDISTRO = XYDISTRO.map((x, i) => {
            return [x[0], x[1], x[2], x[3] - avgXGap * (length - i)]
        })
    }
}
