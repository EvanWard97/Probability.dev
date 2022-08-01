# Probability.dev
Author: Evan Ward <br>
**BLUF:** A micro web app to make generating, refining, and sharing random variables as easy as possible. <br>


Feel free to contact me at evanward97 at gmail if you have any advice or want to help out!

## Why?
Most point estimates can and should, ideally, be thought of as random variables.  It generally hasn't been easy to work with random variables because they often consist of well over 10+ datums for estimating a single point.  Software can now change this.

## Use Cases
- Generating ideal distributions for Monte Carlo methods.  For instance, users will be able to use this tool to generate more precise inputs for Guesstimate-style software.
- Generating a more accurate point-estimate by considering your knowledge about its distribution.  For instance, say you predict a tail outcome has a 10% chance of happening.  While your initial point estimate if you just guess and don't draw a probability distribution might be closer to the distribution's median or mode, you'll be able to have a point estimate that is the mean and takes into account more of your hard-to-articulate knowledge about the point-estimate.
- Sharing your prediction of the probability distribution of a random variable.  It's hard to quickly articulate all the information that can be expressed in a simple distribution that takes 15 seconds to create.

## Possible features to add
- ability to store random variables on a server, and share them with custom permissions.  Further, it would be awesome to have the option of having analytics for random variables, as well as support users 'liking' others' predictions.
- provide an import and export support for Stochastic Information Packets, as well as distributions created with this tool, including their metadata.
- rewrite the drawer to be based on SVG (rather than HTML canvas)for better resolution (especialy text), being easier to scale across different sized screens, making animations of distributions, and other possible benefits.
- put the forms and inputs for interacting with the distributions entirely within a reasonable sized rectangle.  This will make it far easier to use as an iframe on other sites.
- provide means of drawing multiple distributions, and making it easy for users to view only the meta-details about particular distributions at a time.
- provide ways to easily draw a 3rd dimension so as to represent likelihoods, relative weights between distributions, or how likely one expects to possibly update different areas of the distribution after N more hours of thinking about it. Users should be encouraged to select one of several default explanations of this 3rd dimension, or write their own.
- users should be able to "fork" others' variables, and ideally, these similar variables should often be linked with eachother, unless privacy is a top concern.
- a way to initialize more distributions than just a default normal one.  Support for multimodel distributions, such as those featured at foretold.io, would be particularly nice.
- additional support for "smoothing", where one can progressively get rid of abnormal roughness with the click of a button.
- support for simulating various prediction scores, given a distribution, a prediction score methodology, and a resolution.